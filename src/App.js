import React, { useEffect, useState } from 'react';
import socket from './socket';

function HostPanel() {
  const [roomCode, setRoomCode] = useState('');
  const [playerList, setPlayerList] = useState([]);
  const [questionCount, setQuestionCount] = useState(3);
  const [questions, setQuestions] = useState([]);
  const [timeLeft, setTimeLeft] = useState(null);
  const [quizStarted, setQuizStarted] = useState(false);
  const [roomCreated, setRoomCreated] = useState(false); // NEW

  // Set initial questions when count changes
  useEffect(() => {
    const initialQuestions = Array.from({ length: questionCount }, () => ({
      text: '',
      options: ['', '', '', ''],
      correct: '',
      timeLimit: 15,
    }));
    setQuestions(initialQuestions);
  }, [questionCount]);

  // Receive lobby updates
  useEffect(() => {
    socket.on('lobby-update', setPlayerList);
    return () => socket.off('lobby-update');
  }, []);

  // Handle room errors
  useEffect(() => {
    socket.on('room-error', ({ message }) => {
      alert(`Room Error: ${message}`);
      setRoomCode('');
      setRoomCreated(false); // reset on error
    });
    return () => socket.off('room-error');
  }, []);

  // Countdown logic
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;
    const timer = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft]);

  const handleQuestionChange = (index, field, value) => {
    const updated = [...questions];
    updated[index][field] = value;
    setQuestions(updated);
  };

  const handleOptionChange = (qIndex, optIndex, value) => {
    const updated = [...questions];
    updated[qIndex].options[optIndex] = value;
    setQuestions(updated);
  };

  const createRoom = () => {
    if (!roomCode.trim()) return alert('Enter Room Code');
    socket.emit('create-room', roomCode.trim());
    setRoomCreated(true);
  };

  const sendQuestions = () => {
    if (!roomCode.trim()) return alert('Enter Room Code');
    if (!roomCreated) return alert('Please create the room first.');

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text.trim() || q.options.some(opt => !opt.trim()) || !q.correct.trim()) {
        return alert(`Please fill all fields for Question ${i + 1}`);
      }
    }

    socket.emit('join', { name: 'Host', roomCode: roomCode.trim() });

    const formatted = questions.map(q => ({
      ...q,
      correct: q.correct.trim(),
    }));

    socket.emit('send-multiple-questions', {
      roomCode: roomCode.trim(),
      questions: formatted,
    });

    socket.emit('start-quiz', roomCode.trim());
    setTimeLeft(formatted[0].timeLimit || 15);
    setQuizStarted(true);
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>🎮 Host Panel</h2>

      <input
        type="text"
        placeholder="Enter Room Code"
        value={roomCode}
        onChange={(e) => setRoomCode(e.target.value)}
        style={{ width: '100%', marginBottom: '10px' }}
        disabled={quizStarted}
      />

      <button
        onClick={createRoom}
        disabled={!roomCode.trim() || roomCreated || quizStarted}
        style={{ marginBottom: '20px', width: '100%' }}
      >
        🏠 Create Room
      </button>

      <input
        type="number"
        placeholder="Number of Questions"
        min={1}
        value={questionCount}
        onChange={(e) => setQuestionCount(Number(e.target.value))}
        style={{ width: '100%', marginBottom: '20px' }}
        disabled={quizStarted}
      />

      {/* Waiting Lobby */}
      {playerList.length > 0 && (
        <div style={{
          background: '#f4f4f4',
          border: '2px dashed #ccc',
          padding: '15px',
          marginBottom: '20px',
          borderRadius: '8px',
        }}>
          <h3>🕓 Waiting Lobby</h3>
          <ul>
            {playerList.map(p => (
              <li key={p.id}>👤 {p.name}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Question Inputs */}
      {questions.map((q, i) => (
        <div key={i} style={{ border: '1px solid #ccc', padding: '15px', marginBottom: '15px' }}>
          <h3>Question {i + 1}</h3>
          <input
            type="text"
            placeholder="Enter Question"
            value={q.text}
            onChange={(e) => handleQuestionChange(i, 'text', e.target.value)}
            style={{ width: '100%', marginBottom: '10px' }}
            disabled={quizStarted}
          />
          {q.options.map((opt, j) => (
            <input
              key={j}
              type="text"
              placeholder={`Option ${j + 1}`}
              value={opt}
              onChange={(e) => handleOptionChange(i, j, e.target.value)}
              style={{ width: '100%', marginBottom: '5px' }}
              disabled={quizStarted}
            />
          ))}
          <input
            type="text"
            placeholder="Correct Answer"
            value={q.correct}
            onChange={(e) => handleQuestionChange(i, 'correct', e.target.value)}
            style={{ width: '100%', marginBottom: '10px' }}
            disabled={quizStarted}
          />
          <input
            type="number"
            placeholder="Time limit (seconds)"
            value={q.timeLimit}
            onChange={(e) => handleQuestionChange(i, 'timeLimit', Number(e.target.value))}
            style={{ width: '100%', marginBottom: '10px' }}
            disabled={quizStarted}
          />
        </div>
      ))}

      <button onClick={sendQuestions} disabled={quizStarted || !roomCreated}>
        🚀 Send Questions and Start Quiz
      </button>

      {timeLeft !== null && (
        <div style={{ marginTop: '20px', fontWeight: 'bold' }}>
          ⏳ Time Left: {timeLeft}s
        </div>
      )}
    </div>
  );
}

export default HostPanel;
