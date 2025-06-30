import React, { useEffect, useState } from 'react';
import socket from './socket';
import './App.css';

function HostPanel() {
  const [roomCode, setRoomCode] = useState('');
  const [playerList, setPlayerList] = useState([]);
  const [questionCount, setQuestionCount] = useState(3);
  const [questions, setQuestions] = useState([]);
  const [timeLeft, setTimeLeft] = useState(null);
  const [quizStarted, setQuizStarted] = useState(false);
  const [roomCreated, setRoomCreated] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [quizEnded, setQuizEnded] = useState(false);
  const [playerLimit, setPlayerLimit] = useState(10);

  useEffect(() => {
    const initialQuestions = Array.from({ length: questionCount }, () => ({
      text: '',
      options: ['', '', '', ''],
      correct: '',
      timeLimit: 15,
    }));
    setQuestions(initialQuestions);
  }, [questionCount]);

  useEffect(() => {
    socket.on('lobby-update', ({ players }) => setPlayerList(players));
    return () => socket.off('lobby-update');
  }, []);

  useEffect(() => {
    socket.on('room-error', ({ message }) => {
      alert(`Room Error: ${message}`);
      setRoomCode('');
      setRoomCreated(false);
    });
    return () => socket.off('room-error');
  }, []);

  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;
    const timer = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft]);

  useEffect(() => {
    socket.on('leaderboard', setLeaderboard);
    socket.on('quiz-ended', () => {
      setQuizEnded(true);
      setTimeLeft(null);
    });
    return () => {
      socket.off('leaderboard');
      socket.off('quiz-ended');
    };
  }, []);

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
    socket.emit('create-room', {
      roomCode: roomCode.trim(),
      maxPlayers: playerLimit, // players only
    });
    setRoomCreated(true);
  };

  const sendQuestions = () => {
    if (!roomCode.trim()) return alert('Enter Room Code');
    if (!roomCreated) return alert('Please create the room first.');

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (
        !q.text.trim() ||
        q.options.some(opt => !opt.trim()) ||
        !q.correct.trim() ||
        isNaN(q.correct) ||
        q.correct < 0 ||
        q.correct > 3
      ) {
        return alert(`Please fill all fields correctly for Question ${i + 1}`);
      }
    }

    const formatted = questions.map(q => {
      const correctIndex = parseInt(q.correct, 10);
      return {
        ...q,
        correct: q.options[correctIndex] || '',
      };
    });

    socket.emit('send-multiple-questions', {
      roomCode: roomCode.trim(),
      questions: formatted,
    });

    socket.emit('start-quiz', roomCode.trim());
    setTimeLeft(formatted[0].timeLimit || 15);
    setQuizStarted(true);
  };

  const handleKick = (playerId) => {
    if (window.confirm('Are you sure you want to kick this player?')) {
      socket.emit('kick-player', { roomCode: roomCode.trim(), playerId });
    }
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

      <input
        type="number"
        placeholder="Max Players (excluding host)"
        min={1}
        value={playerLimit}
        onChange={(e) => setPlayerLimit(Number(e.target.value))}
        style={{ width: '100%', marginBottom: '10px' }}
        disabled={roomCreated || quizStarted}
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
              <li key={p.id}>
                {p.emoji || '👤'} {p.name}
                {!quizStarted && (
                  <button
                    onClick={() => handleKick(p.id)}
                    style={{
                      marginLeft: '10px',
                      backgroundColor: 'red',
                      color: 'white',
                      border: 'none',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    ❌ Kick
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {questions.map((q, i) => (
        <div key={i} style={{ border: '1px solid #ccc', padding: '15px', marginBottom: '15px' }}>
          <h3>Question {i + 1}</h3>

          <textarea
            placeholder="Paste 6 lines:\n1. Question\n2-5. Options\n6. Correct Option Index (0-3)"
            rows={6}
            style={{ width: '100%', marginBottom: '10px', backgroundColor: '#fdf9dd', padding: '8px' }}
            onPaste={(e) => {
              e.preventDefault();
              const pasted = e.clipboardData.getData('text').trim();
              const lines = pasted.split('\n').map(line => line.trim());
              if (lines.length < 6) {
                alert('❌ Paste format must include 6 lines: question, 4 options, correct index');
                return;
              }

              const [text, ...opts] = lines;
              const correct = opts.pop();
              const updated = [...questions];
              updated[i] = {
                ...updated[i],
                text,
                options: opts,
                correct: correct.trim(),
              };
              setQuestions(updated);
            }}
            disabled={quizStarted}
          />

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
            type="number"
            placeholder="Correct Option Number (0-3)"
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

      {leaderboard.length > 0 && (
        <div style={{
          marginTop: '30px',
          padding: '15px',
          border: '2px solid #888',
          borderRadius: '8px',
          backgroundColor: '#f9f9f9'
        }}>
          <h3>{quizEnded ? '🎉 Final Leaderboard' : '🏆 Live Leaderboard'}</h3>
          <ul style={{ listStyleType: 'none', padding: 0 }}>
            {leaderboard
              .filter(p => p.name.toLowerCase() !== 'host')
              .sort((a, b) => b.score - a.score)
              .map((p, index) => (
                <li key={p.id} style={{ marginBottom: '6px' }}>
                  {index + 1}. {p.emoji || '👤'} {p.name} - {p.score} pts
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default HostPanel;
