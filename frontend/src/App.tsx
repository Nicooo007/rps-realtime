import { useState, useEffect, useRef } from 'react'
import io, { Socket } from 'socket.io-client'

const socket: Socket = io(import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000')

type Screen = 'landing' | 'lobby' | 'waiting' | 'game' | 'result'

type Result = {
  myChoice: string
  opponentAlias: string
  opponentChoice: string
  winnerAlias: string
}

const emojis: Record<string, string> = { rock: '🪨', paper: '📄', scissors: '✂️' }

function App() {
  const [screen, setScreen] = useState<Screen>('landing')
  const [alias, setAlias] = useState('')
  const aliasRef = useRef(alias)

  const [roomId, setRoomId] = useState<string | null>(null)
  const [rooms, setRooms] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)

  const [myChoice, setMyChoice] = useState<string | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [result, setResult] = useState<Result | null>(null)

  const [rematch, setRematch] = useState<'idle' | 'waiting' | 'incoming'>('idle')
  const [disconnectMsg, setDisconnectMsg] = useState<string | null>(null)

  // ref para leer alias actualizado dentro de callbacks de socket
  useEffect(() => { aliasRef.current = alias }, [alias])

  useEffect(() => {
    socket.on('rooms_update', setRooms)

    socket.on('room_joined', ({ roomId: id, playerIndex }: { roomId: string; playerIndex: number }) => {
      setRoomId(id)
      setScreen(playerIndex === 0 ? 'waiting' : 'game')
    })

    socket.on('game_start', () => {
      setMyChoice(null)
      setResult(null)
      setRematch('idle')
      setDisconnectMsg(null)
      setScreen('game')
    })

    socket.on('countdown', setCountdown)

    socket.on('reveal', (data: { p1: { alias: string; choice: string }; p2: { alias: string; choice: string }; winnerAlias: string }) => {
      const me = data.p1.alias === aliasRef.current
      setResult({
        myChoice: me ? data.p1.choice : data.p2.choice,
        opponentAlias: me ? data.p2.alias : data.p1.alias,
        opponentChoice: me ? data.p2.choice : data.p1.choice,
        winnerAlias: data.winnerAlias,
      })
      setCountdown(null)
      setRematch('idle')
      setScreen('result')
    })

    socket.on('game_restart', () => {
      setMyChoice(null)
      setResult(null)
      setRematch('idle')
      setDisconnectMsg(null)
      setCountdown(null)
      setScreen('game')
    })

    socket.on('opponent_wants_rematch', () => {
      setRematch(prev => prev === 'waiting' ? 'waiting' : 'incoming')
    })

    socket.on('opponent_left', (who: string) => {
      setDisconnectMsg(`${who} se desconectó`)
      setRoomId(null)
      setTimeout(() => {
        setDisconnectMsg(null)
        setMyChoice(null)
        setResult(null)
        setRematch('idle')
        socket.emit('get_rooms')
        setScreen('lobby')
      }, 2500)
    })

    socket.on('error', (msg: string) => {
      setError(msg)
      setTimeout(() => setError(null), 3500)
    })

    // cleanup al desmontar
    return () => {
      ['rooms_update','room_joined','game_start','countdown','reveal',
       'game_restart','opponent_wants_rematch','opponent_left','error'].forEach(e => socket.off(e))
    }
  }, [])

  // refresca la lista cada 3s mientras está en el lobby
  useEffect(() => {
    if (screen !== 'lobby') return
    const t = setInterval(() => socket.emit('get_rooms'), 3000)
    return () => clearInterval(t)
  }, [screen])

  const enterLobby = () => {
    if (!alias.trim()) return
    socket.emit('get_rooms')
    setScreen('lobby')
  }

  const pick = (choice: string) => {
    if (myChoice) return
    socket.emit('play', { roomId, choice })
    setMyChoice(choice)
  }

  const goLobby = () => {
    socket.emit('leave_room', roomId)
    setRoomId(null)
    setMyChoice(null)
    setResult(null)
    setRematch('idle')
    socket.emit('get_rooms')
    setScreen('lobby')
  }

  return (
    <div className="app">

      {screen === 'landing' && (
        <div className="home-wrapper">
          <h1 className="home-title">Rock Paper <span>Scissors</span></h1>
          <input
            className="home-input"
            placeholder="Tu alias"
            value={alias}
            onChange={e => setAlias(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && enterLobby()}
          />
          <button className="home-btn" onClick={enterLobby}>Ingresar</button>
        </div>
      )}

      {screen === 'lobby' && (
        <div className="home-wrapper">
          <h1 className="home-title">Rock Paper <span>Scissors</span></h1>

          <button className="home-btn" onClick={() => socket.emit('create_room', alias)}>
            + Crear Sala Nueva
          </button>

          {error && <div className="lobby-error">⚠️ {error}</div>}

          <div id="rooms-list">
            <h3>Salas disponibles</h3>
            {rooms.length === 0 ? (
              <p className="empty-rooms">No hay salas disponibles</p>
            ) : rooms.map(room => {
              const full = room.status !== 'waiting'
              return (
                <div key={room.id} className={`room-item ${full ? 'full' : ''}`}>
                  <p>
                    Sala <strong>{room.id}</strong>
                    <span className={`room-status ${full ? 'full' : 'waiting'}`}>
                      {full ? 'Llena' : 'Esperando'}
                    </span>
                  </p>
                  <button
                    className="home-btn"
                    disabled={full}
                    onClick={() => socket.emit('join_room', { roomId: room.id, alias })}
                  >
                    {full ? 'Llena' : 'Unirse'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {screen === 'waiting' && (
        <div className="home-wrapper">
          <h1 className="home-title">Rock Paper <span>Scissors</span></h1>
          <p className="home-subtitle">Sala creada: <strong>{roomId}</strong></p>
          <span className="status-badge active">
            <span className="dot" /> Esperando oponente...
          </span>
          <button className="home-btn" style={{ marginTop: '2rem' }} onClick={() => {
            socket.emit('leave_room', roomId)
            setRoomId(null)
            socket.emit('get_rooms')
            setScreen('lobby')
          }}>
            Cancelar
          </button>
        </div>
      )}

      {screen === 'game' && (
        <div className="game-wrapper">
          {disconnectMsg ? (
            <div className="disconnect-msg">⚠️ {disconnectMsg}</div>
          ) : countdown !== null ? (
            <div className="countdown-wrapper">
              <p className="countdown-label">Revelando elecciones en</p>
              <div className="countdown-number" key={countdown}>{countdown}</div>
            </div>
          ) : (
            <>
              <h2 className="game-title">Sala: {roomId}</h2>
              {myChoice ? (
                <span className="status-badge active">
                  <span className="dot" /> Esperando al oponente...
                </span>
              ) : (
                <p className="status-text">Elige tu jugada</p>
              )}
              <div className="moves-container">
                {(['rock', 'paper', 'scissors'] as const).map(c => (
                  <button
                    key={c}
                    className={`move-btn ${myChoice === c ? 'selected' : ''}`}
                    onClick={() => pick(c)}
                    disabled={!!myChoice}
                  >
                    {emojis[c]} <span className="label">{{ rock: 'Piedra', paper: 'Papel', scissors: 'Tijeras' }[c]}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {screen === 'result' && result && (
        <div className="result-card">
          <p className="result-title">Resultado</p>

          <div className="result-vs">
            <div className={`result-player ${result.winnerAlias === alias ? 'winner' : ''}`}>
              <span className="choice-emoji">{emojis[result.myChoice]}</span>
              <span className="player-name">Tú</span>
              <span className="player-choice">{result.myChoice}</span>
            </div>
            <div className="vs-label">vs</div>
            <div className={`result-player ${result.winnerAlias === result.opponentAlias ? 'winner' : ''}`}>
              <span className="choice-emoji">{emojis[result.opponentChoice]}</span>
              <span className="player-name">{result.opponentAlias}</span>
              <span className="player-choice">{result.opponentChoice}</span>
            </div>
          </div>

          {result.winnerAlias === 'tie'
            ? <div className="result-winner-banner tie">🤝 ¡Empate!</div>
            : result.winnerAlias === alias
              ? <div className="result-winner-banner won">🏆 ¡Ganaste!</div>
              : <div className="result-winner-banner lost">😔 Ganó {result.winnerAlias}</div>
          }

          {disconnectMsg ? (
            <div className="disconnect-msg">⚠️ {disconnectMsg}</div>
          ) : (
            <div className="result-actions">
              <button
                className="home-btn"
                onClick={() => { setRematch('waiting'); socket.emit('request_rematch', roomId) }}
                disabled={rematch === 'waiting'}
              >
                {rematch === 'idle' && '🔄 Jugar de nuevo'}
                {rematch === 'waiting' && '⏳ Esperando confirmación...'}
                {rematch === 'incoming' && '✅ ¡Aceptar revancha!'}
              </button>
              <button className="home-btn secondary" onClick={goLobby}>
                🏠 Volver al lobby
              </button>
            </div>
          )}
        </div>
      )}

    </div>
  )
}

export default App