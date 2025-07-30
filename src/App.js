import React, { useState, useEffect, useMemo } from 'react';
import { create } from 'zustand';

// --- The Zustand Store: store/quizStore.js ---
// Now includes a place to store the dynamically loaded questions.
export const useQuizStore = create((set, get) => ({
  allQuestions: [], // Will be populated from the user's file
  questions: [],
  currentQuestionIndex: 0,
  isTestRunning: false,
  startTime: 0,
  finalResults: null,
  testDurationMinutes: 0,

  loadQuestions: (questions) => {
    // This new action will be called when a file is loaded
    set({ allQuestions: questions });
  },

  startQuiz: (config) => {
    const { allQuestions } = get();
    let filteredQuestions = allQuestions;

    if (config.type === 'subject') {
        filteredQuestions = allQuestions.filter(q => q.category === config.value);
    } else if (config.type === 'paper') {
        filteredQuestions = allQuestions.filter(q => q.subCategory === config.value);
    }

    const shuffled = filteredQuestions.sort(() => 0.5 - Math.random());
    const selectedQuestions = shuffled.slice(0, config.count);
    const duration = Math.ceil(config.count * 1.2); 
    
    set({
      questions: selectedQuestions.map(q => ({ ...q, userAnswer: null, showAnswer: false })),
      currentQuestionIndex: 0,
      isTestRunning: true,
      startTime: Date.now(),
      finalResults: null,
      testDurationMinutes: duration,
    });
  },

  selectAnswer: (questionId, answer) => {
    set((state) => ({
      questions: state.questions.map((q) =>
        q.id === questionId ? { ...q, userAnswer: answer } : q
      ),
    }));
  },

  checkAnswer: (questionId) => {
    set((state) => ({
        questions: state.questions.map((q) => 
            q.id === questionId ? { ...q, showAnswer: true } : q
        ),
    }));
  },
  
  navigateToQuestion: (index) => {
    if(index >= 0 && index < get().questions.length) {
      set({ currentQuestionIndex: index });
    }
  },

  submitTest: () => {
    const analysis = calculateAnalysis(get().questions);
    set({ finalResults: analysis, isTestRunning: false });
  },
  
  reset: () => {
      set((state) => ({
        questions: [], 
        currentQuestionIndex: 0, 
        isTestRunning: false, 
        startTime: 0, 
        finalResults: null, 
        testDurationMinutes: 0,
        // Keep allQuestions loaded
        allQuestions: state.allQuestions 
      }));
  }
}));

// --- Helper function for analysis with negative marking ---
const calculateAnalysis = (questions) => {
  const totalQuestions = questions.length;
  let correctCount = 0;
  let incorrectCount = 0;
  const topicStats = {};

  questions.forEach((q) => {
    const category = q.category || 'General';
    if (!topicStats[category]) {
      topicStats[category] = { correct: 0, total: 0 };
    }
    
    if (q.userAnswer) {
        topicStats[category].total++;
        if (q.userAnswer === q.answer) {
            correctCount++;
            topicStats[category].correct++;
        } else {
            incorrectCount++;
        }
    }
  });

  const score = correctCount - (incorrectCount * 0.25);
  const accuracy = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;
  const passed = totalQuestions > 0 ? score >= (totalQuestions * 0.6) : false;

  const topicAnalysis = Object.entries(topicStats).map(([topic, stats]) => ({
    topic,
    accuracy: stats.total > 0 ? (stats.correct / stats.total) * 100 : 0,
    ...stats,
  }));

  return {
    score, correctCount, totalQuestions, accuracy, passed, topicAnalysis, answeredQuestions: questions,
  };
};


// --- Components ---

function QuestionCard({ question, questionNumber }) {
  const { selectAnswer, checkAnswer } = useQuizStore();
  const { userAnswer, showAnswer } = question;

  const handleSelectAnswer = (option) => {
    if (userAnswer) return; // Lock answer once selected
    selectAnswer(question.id, option);
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-4">
        Question {questionNumber}
      </h2>
      <p className="text-lg text-gray-700 mb-6">{question.question}</p>

      <div className="space-y-4">
        {question.options.map((option, index) => {
            const isSelected = userAnswer === option;
            const isCorrect = question.answer === option;
            let borderColor = 'border-gray-300 hover:border-blue-400';
            if (showAnswer) {
                if (isCorrect) borderColor = 'border-green-500 bg-green-50';
                else if (isSelected) borderColor = 'border-red-500 bg-red-50';
            } else if (isSelected) {
                borderColor = 'border-blue-500 bg-blue-50';
            }

            return (
              <div
                key={index}
                onClick={() => handleSelectAnswer(option)}
                className={`p-4 border-2 rounded-lg transition-all ${userAnswer ? 'cursor-default' : 'cursor-pointer'} ${borderColor}`}
              >
                <span className="font-medium text-gray-800">{option}</span>
              </div>
            );
        })}
      </div>
      {userAnswer && !showAnswer && (
          <button 
            onClick={() => checkAnswer(question.id)}
            className="mt-6 px-6 py-2 bg-yellow-500 text-white font-semibold rounded-lg shadow-md hover:bg-yellow-600"
          >
              Check Answer
          </button>
      )}
    </div>
  );
}

function QuizTimer() {
  const { startTime, submitTest, testDurationMinutes } = useQuizStore();
  const [timeLeft, setTimeLeft] = useState(testDurationMinutes * 60);

  useEffect(() => { setTimeLeft(testDurationMinutes * 60) }, [testDurationMinutes]);

  useEffect(() => {
    if (!startTime) return;
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = testDurationMinutes * 60 - elapsed;
      if (remaining <= 0) {
        clearInterval(interval);
        setTimeLeft(0);
        submitTest();
      } else {
        setTimeLeft(remaining);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime, testDurationMinutes, submitTest]);
  
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="mb-8 p-4 bg-gray-100 rounded-lg text-center">
      <h2 className="text-lg font-semibold text-gray-700">Time Remaining</h2>
      <p className="text-4xl font-bold text-blue-600 mt-2">
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </p>
    </div>
  );
}

const getStatusColor = (q) => {
  if (q.showAnswer) {
      return q.userAnswer === q.answer ? 'bg-green-500 text-white' : 'bg-red-500 text-white';
  }
  if (q.userAnswer) return 'bg-blue-500 text-white';
  return 'bg-gray-200 text-gray-700';
};

function QuizSummary() {
  const { questions, navigateToQuestion } = useQuizStore();
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-700 mb-4">Question Palette</h2>
      <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-7 lg:grid-cols-10 gap-2">
        {questions.map((q, index) => (
          <button
            key={q.id}
            onClick={() => navigateToQuestion(index)}
            className={`w-10 h-10 flex items-center justify-center rounded-md font-bold transition-colors ${getStatusColor(q)}`}
          >
            {index + 1}
          </button>
        ))}
      </div>
       <div className="mt-4 space-y-2 text-sm text-gray-600">
        <div className="flex items-center"><span className="w-4 h-4 rounded-full bg-blue-500 mr-2"></span> Answered</div>
        <div className="flex items-center"><span className="w-4 h-4 rounded-full bg-green-500 mr-2"></span> Correct</div>
        <div className="flex items-center"><span className="w-4 h-4 rounded-full bg-red-500 mr-2"></span> Incorrect</div>
        <div className="flex items-center"><span className="w-4 h-4 rounded-full bg-gray-200 mr-2 border border-gray-400"></span> Not Answered</div>
      </div>
    </div>
  );
}


// --- Pages ---

function HomePage({ navigate }) {
  const { startQuiz, loadQuestions, allQuestions } = useQuizStore();
  const [quizType, setQuizType] = useState('all'); // all, subject, paper
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedPaper, setSelectedPaper] = useState('');
  const [numQuestions, setNumQuestions] = useState(10);
  const [error, setError] = useState('');

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file && file.type === "application/json") {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target.result;
          const parsedQuestions = JSON.parse(content);
          // Assuming the structure is an array of question objects
          if (Array.isArray(parsedQuestions) && parsedQuestions.length > 0) {
              loadQuestions(parsedQuestions);
              setError('');
          } else {
              setError("Invalid JSON format. Expected an array of questions.");
          }
        } catch (err) {
          setError("Error parsing JSON file.");
          console.error(err);
        }
      };
      reader.readAsText(file);
    } else {
      setError("Please select a valid JSON file.");
    }
  };

  const { subjects, papers, maxQuestions } = useMemo(() => {
      if (allQuestions.length === 0) return { subjects: [], papers: [], maxQuestions: 0 };

      const subjects = [...new Set(allQuestions.map(q => q.category))];
      const papers = [...new Set(allQuestions.map(q => q.subCategory))];
      
      let currentMax = allQuestions.length;
      if (quizType === 'subject') {
          currentMax = allQuestions.filter(q => q.category === selectedSubject).length;
      } else if (quizType === 'paper') {
          currentMax = allQuestions.filter(q => q.subCategory === selectedPaper).length;
      }
      
      if(selectedSubject === '' && subjects.length > 0) setSelectedSubject(subjects[0]);
      if(selectedPaper === '' && papers.length > 0) setSelectedPaper(papers[0]);

      return { subjects, papers, maxQuestions: currentMax };
  }, [quizType, selectedSubject, selectedPaper, allQuestions]);

  useEffect(() => {
      if (numQuestions > maxQuestions) {
          setNumQuestions(maxQuestions || 1);
      }
  }, [maxQuestions, numQuestions]);

  const handleStartQuiz = () => {
    let config = { type: 'all', value: null, count: numQuestions };
    if (quizType === 'subject') {
        config = { type: 'subject', value: selectedSubject, count: numQuestions };
    } else if (quizType === 'paper') {
        config = { type: 'paper', value: selectedPaper, count: numQuestions };
    }
    startQuiz(config);
    navigate('quiz');
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-50">
      <div className="w-full max-w-2xl text-center">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">NISM Derivatives Practice Exam</h1>
        <p className="text-lg text-gray-600 mb-12">Load your question file to begin.</p>
        
        <div className="p-8 bg-white rounded-xl shadow-lg border border-gray-200 text-left">
          <div className="mb-6">
            <label className="block text-lg font-medium text-gray-700 mb-2 text-center">
              Load Question File
            </label>
            <input 
              type="file" 
              accept=".json" 
              onChange={handleFileChange}
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {error && <p className="text-red-500 text-sm mt-2 text-center">{error}</p>}
          </div>

          {allQuestions.length > 0 && (
            <>
              <h2 className="text-2xl font-semibold text-blue-600 mb-6 text-center border-t pt-6 mt-6">Customize Your Quiz</h2>
              
              <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Quiz Type</label>
                  <select onChange={(e) => setQuizType(e.target.value)} value={quizType} className="w-full p-2 border border-gray-300 rounded-md">
                      <option value="all">Random Mix (All Subjects)</option>
                      <option value="subject">Specific Subject</option>
                      <option value="paper">Specific Paper</option>
                  </select>
              </div>

              {quizType === 'subject' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Subject</label>
                  <select onChange={(e) => setSelectedSubject(e.target.value)} value={selectedSubject} className="w-full p-2 border border-gray-300 rounded-md">
                      {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}

              {quizType === 'paper' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Paper</label>
                  <select onChange={(e) => setSelectedPaper(e.target.value)} value={selectedPaper} className="w-full p-2 border border-gray-300 rounded-md">
                      {papers.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              )}

              <div className="mb-6">
                <label htmlFor="numQuestions" className="block text-lg font-medium text-gray-700 mb-2">
                  Number of Questions: <span className="font-bold text-blue-600">{numQuestions}</span>
                </label>
                <input
                  type="range"
                  id="numQuestions"
                  min="1"
                  max={maxQuestions}
                  value={numQuestions}
                  onChange={(e) => setNumQuestions(Number(e.target.value))}
                  className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer range-lg"
                />
                 <p className="text-xs text-gray-500 mt-2 text-center">Available questions for this selection: {maxQuestions}</p>
              </div>

              <button
                onClick={handleStartQuiz}
                disabled={numQuestions === 0 || maxQuestions === 0}
                className="w-full px-6 py-4 bg-blue-600 text-white font-semibold text-lg rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 transition-transform transform hover:scale-105 disabled:bg-gray-400 disabled:scale-100"
              >
                Start Quiz
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function QuizPage({ navigate }) {
  const { questions, currentQuestionIndex, navigateToQuestion, submitTest, isTestRunning, finalResults } = useQuizStore();
  const currentQuestion = questions[currentQuestionIndex];
  
  useEffect(() => {
    if (!isTestRunning && !finalResults) { navigate('home') }
    if (finalResults) { navigate('results') }
  }, [isTestRunning, finalResults, navigate]);

  if (!isTestRunning || !currentQuestion) { return <div className="flex h-screen items-center justify-center">Loading quiz...</div> }

  const handleNext = () => navigateToQuestion(currentQuestionIndex + 1);
  const handlePrev = () => navigateToQuestion(currentQuestionIndex - 1);
  const handleSubmit = () => submitTest();

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-100">
      <div className="w-full md:w-2/3 p-4 md:p-8 flex flex-col">
        <div className="bg-white p-6 rounded-lg shadow-md flex-grow">
          <QuestionCard question={currentQuestion} questionNumber={currentQuestionIndex + 1} />
        </div>
        <div className="mt-6 flex justify-between items-center">
          <button onClick={handlePrev} disabled={currentQuestionIndex === 0} className="px-6 py-2 bg-gray-300 text-gray-700 font-semibold rounded-lg disabled:opacity-50 hover:bg-gray-400">Previous</button>
          <button onClick={handleSubmit} className="px-6 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700">Submit Test</button>
          <button onClick={handleNext} disabled={currentQuestionIndex === questions.length - 1} className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg disabled:opacity-50 hover:bg-blue-700">Next</button>
        </div>
      </div>
      <div className="w-full md:w-1/3 p-4 md:p-8 bg-white border-l border-gray-200"><div className="sticky top-8"><QuizTimer /><QuizSummary /></div></div>
    </div>
  );
}

function ResultsPage({ navigate }) {
  const { finalResults, reset } = useQuizStore();
  const [showReview, setShowReview] = useState(false);
  const [aiStudyPlan, setAiStudyPlan] = useState('');
  const [isPlanLoading, setIsPlanLoading] = useState(false);
  const [aiExplanations, setAiExplanations] = useState({});
  const [loadingExplanations, setLoadingExplanations] = useState({});

  useEffect(() => { if (!finalResults) { navigate('home') } }, [finalResults, navigate]);

  const callGeminiAPI = async (prompt) => {
      const chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
      const payload = { contents: chatHistory };
      const apiKey = process.env.REACT_APP_GEMINI_API_KEY; 
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
      try {
          const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          if (!response.ok) { throw new Error(`API call failed with status: ${response.status}`) }
          const result = await response.json();
          if (result.candidates?.[0]?.content?.parts?.[0]) { return result.candidates[0].content.parts[0].text }
          console.error("Unexpected response structure:", result);
          return "Could not get a valid response from the AI.";
      } catch (error) {
          console.error("Error calling Gemini API:", error);
          return "An error occurred while contacting the AI.";
      }
  };

  const handleGenerateStudyPlan = async () => {
      setIsPlanLoading(true); setAiStudyPlan('');
      const topicSummary = finalResults.topicAnalysis.map(t => `${t.topic}: ${t.accuracy.toFixed(0)}% accuracy`).join(', ');
      const prompt = `I just took a practice test for the NISM Derivatives exam. My performance was: ${topicSummary}. Based on these results, please identify my weakest topics and generate a concise, actionable study plan to help me improve. The plan should be encouraging and motivational. Format the output using markdown.`;
      const plan = await callGeminiAPI(prompt);
      setAiStudyPlan(plan); setIsPlanLoading(false);
  };

  const handleAiExplanation = async (questionId) => {
      setLoadingExplanations(prev => ({ ...prev, [questionId]: true }));
      const question = finalResults.answeredQuestions.find(q => q.id === questionId);
      const prompt = `For a student preparing for the NISM Derivatives exam in India, please explain why the correct answer to the following question is "${question.answer}". Also, clarify why "${question.userAnswer}" is incorrect. Keep the tone simple and clear.\n\nQuestion: "${question.question}"\n\nBase Explanation (for context): "${question.explanation}"`;
      const explanation = await callGeminiAPI(prompt);
      setAiExplanations(prev => ({ ...prev, [questionId]: explanation }));
      setLoadingExplanations(prev => ({ ...prev, [questionId]: false }));
  };

  if (!finalResults) { return <div className="flex h-screen items-center justify-center">Loading results...</div> }
  
  const handleGoHome = () => { reset(); navigate('home') }
  const { score, totalQuestions, passed, topicAnalysis, answeredQuestions, accuracy, correctCount } = finalResults;

  return (
    <main className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto bg-white p-8 rounded-xl shadow-lg">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">Test Results</h1>
        <div className={`text-5xl font-extrabold text-center mb-6 ${passed ? 'text-green-500' : 'text-red-500'}`}>{passed ? 'PASS' : 'FAIL'}</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center mb-10">
          <div className="p-4 bg-blue-50 rounded-lg"><p className="text-sm font-semibold text-blue-800">SCORE (with negative marking)</p><p className="text-3xl font-bold text-blue-600">{score.toFixed(2)} / {totalQuestions}</p></div>
          <div className="p-4 bg-green-50 rounded-lg"><p className="text-sm font-semibold text-green-800">ACCURACY (Correct Answers)</p><p className="text-3xl font-bold text-green-600">{accuracy.toFixed(2)}% ({correctCount}/{totalQuestions})</p></div>
          <div className="p-4 bg-yellow-50 rounded-lg"><p className="text-sm font-semibold text-yellow-800">PASS MARK</p><p className="text-3xl font-bold text-yellow-600">60%</p></div>
        </div>
        <div className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-700 mb-4">Performance by Topic</h2>
          <div className="space-y-4">
            {topicAnalysis.map(({ topic, accuracy, correct, total }) => (
              <div key={topic} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-center mb-1"><span className="font-medium text-gray-800">{topic}</span><span className="text-sm font-semibold text-gray-600">{correct}/{total}</span></div>
                <div className="w-full bg-gray-200 rounded-full h-2.5"><div className={`${accuracy >= 60 ? 'bg-green-500' : 'bg-red-500'} h-2.5 rounded-full`} style={{ width: `${accuracy}%` }}></div></div>
              </div>
            ))}
          </div>
        </div>
        <div className="my-10 p-6 bg-blue-50 border-l-4 border-blue-500 rounded-r-lg">
          <h2 className="text-2xl font-semibold text-gray-700 mb-4">Personalized Study Plan</h2>
          <button onClick={handleGenerateStudyPlan} disabled={isPlanLoading} className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 disabled:bg-gray-400">{isPlanLoading ? '✨ Generating...' : '✨ Generate AI Study Plan'}</button>
          {isPlanLoading && <div className="mt-4">Getting your plan from the AI...</div>}
          {aiStudyPlan && <div className="mt-4 p-4 bg-white rounded-lg prose" dangerouslySetInnerHTML={{ __html: aiStudyPlan.replace(/\n/g, '<br />') }} />}
        </div>
        <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-4">
          <button onClick={handleGoHome} className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700">Take Another Test</button>
          <button onClick={() => setShowReview(!showReview)} className="px-8 py-3 bg-gray-700 text-white font-semibold rounded-lg shadow-md hover:bg-gray-800">{showReview ? 'Hide Review' : 'Review Answers'}</button>
        </div>
        {showReview && (
          <div className="mt-12">
            <h2 className="text-2xl font-semibold text-gray-700 mb-6 border-t pt-8">Answer Review</h2>
            <div className="space-y-8">
              {answeredQuestions.map((q, index) => (
                <div key={q.id} className="p-6 bg-gray-50 rounded-lg border">
                  <p className="font-semibold text-lg mb-4">Q{index+1}: {q.question}</p>
                  <div className="space-y-2 text-md">
                    <p><strong>Your Answer:</strong> <span className={q.userAnswer === q.answer ? 'text-green-600' : 'text-red-600'}>{q.userAnswer || 'Not Answered'}</span></p>
                    <p><strong>Correct Answer:</strong> <span className="text-green-600">{q.answer}</span></p>
                    {q.explanation && <p className="mt-2 pt-2 border-t text-gray-600"><strong>Explanation:</strong> {q.explanation}</p>}
                    <div className="mt-4">
                      <button onClick={() => handleAiExplanation(q.id)} disabled={loadingExplanations[q.id]} className="px-4 py-1 text-sm bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700 disabled:bg-gray-400">{loadingExplanations[q.id] ? '✨ Generating...' : '✨ Get AI Explanation'}</button>
                      {loadingExplanations[q.id] && <div className="mt-2 text-sm">Getting AI explanation...</div>}
                      {aiExplanations[q.id] && <div className="mt-2 p-3 bg-purple-50 rounded-lg text-sm" dangerouslySetInnerHTML={{ __html: aiExplanations[q.id].replace(/\n/g, '<br />') }} />}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}


// --- Main App Component (Router) ---
export default function App() {
  const [page, setPage] = useState('home'); // 'home', 'quiz', 'results'
  const navigate = (newPage) => setPage(newPage);

  const renderPage = () => {
    switch(page) {
      case 'quiz': return <QuizPage navigate={navigate} />;
      case 'results': return <ResultsPage navigate={navigate} />;
      case 'home': default: return <HomePage navigate={navigate} />;
    }
  }

  return (
    <>
      <link href="https://cdn.tailwindcss.com" rel="stylesheet" />
      <link href="https://cdn.jsdelivr.net/npm/@tailwindcss/typography@0.5.x/dist/typography.min.css" rel="stylesheet" />
      {renderPage()}
    </>
  );
}
