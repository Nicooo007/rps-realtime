import { Server, Socket } from 'socket.io'
import { getWinner } from '../game/gameLogic'
import { Choice } from '../types/gameTypes'

interface Player {
  id: string
  alias: string
  choice: Choice | null
  rematch: boolean
}

interface Room {
  id: string
  players: Player[]
  status: 'waiting' | 'playing' | 'finished'
}

const rooms = new Map<string, Room>()

const publicRooms = () =>
  [...rooms.values()].map(r => ({ id: r.id, status: r.status, playerCount: r.players.length }))

const sync = (io: Server) => io.emit('rooms_update', publicRooms())

export function setupSockets(io: Server) {
  io.on('connection', (socket: Socket) => {
    socket.emit('rooms_update', publicRooms())

    socket.on('get_rooms', () => socket.emit('rooms_update', publicRooms()))

    socket.on('create_room', (alias: string) => {
      const id = Math.random().toString(36).substring(2, 7).toUpperCase()
      rooms.set(id, { id, players: [{ id: socket.id, alias, choice: null, rematch: false }], status: 'waiting' })
      socket.join(id)
      socket.emit('room_joined', { roomId: id, playerIndex: 0 })
      sync(io)
    })

    socket.on('join_room', ({ roomId, alias }: { roomId: string; alias: string }) => {
      const room = rooms.get(roomId)
      if (!room) return socket.emit('error', 'Sala no encontrada.')
      if (room.players.length >= 2) return socket.emit('error', 'La sala está llena.')
      if (room.status !== 'waiting') return socket.emit('error', 'La partida ya comenzó.')

      room.players.push({ id: socket.id, alias, choice: null, rematch: false })
      room.status = 'playing'
      socket.join(roomId)
      socket.emit('room_joined', { roomId, playerIndex: 1 })
      io.to(roomId).emit('game_start')
      sync(io)
    })

    // ambos eligieron -> countdown y reveal
    socket.on('play', ({ roomId, choice }: { roomId: string; choice: Choice }) => {
      const room = rooms.get(roomId)
      if (!room) return
      const player = room.players.find(p => p.id === socket.id)
      if (!player || player.choice) return

      player.choice = choice

      const [p1, p2] = room.players
      if (p1.choice && p2.choice) {
        const outcome = getWinner(p1.choice, p2.choice)
        const winnerAlias = outcome === 'p1' ? p1.alias : outcome === 'p2' ? p2.alias : 'tie'

        room.status = 'finished'
        io.to(roomId).emit('countdown', 3)
        setTimeout(() => io.to(roomId).emit('countdown', 2), 1000)
        setTimeout(() => io.to(roomId).emit('countdown', 1), 2000)
        setTimeout(() => {
          io.to(roomId).emit('reveal', {
            p1: { alias: p1.alias, choice: p1.choice },
            p2: { alias: p2.alias, choice: p2.choice },
            winnerAlias,
          })
          sync(io)
        }, 3000)
      }
    })

    // revancha: si los dos la piden, se reinicia
    socket.on('request_rematch', (roomId: string) => {
      const room = rooms.get(roomId)
      if (!room) return
      const player = room.players.find(p => p.id === socket.id)
      if (!player) return

      player.rematch = true
      socket.to(roomId).emit('opponent_wants_rematch', { alias: player.alias })

      if (room.players.every(p => p.rematch)) {
        room.players.forEach(p => { p.choice = null; p.rematch = false })
        room.status = 'playing'
        io.to(roomId).emit('game_restart')
        sync(io)
      }
    })

    socket.on('leave_room', (roomId: string) => drop(socket, roomId, io))

    socket.on('disconnect', () => {
      rooms.forEach((_, id) => {
        if (rooms.get(id)?.players.find(p => p.id === socket.id)) drop(socket, id, io)
      })
    })
  })
}

// borra la sala completamente 
function drop(socket: Socket, roomId: string, io: Server) {
  const room = rooms.get(roomId)
  if (!room) return
  const leaving = room.players.find(p => p.id === socket.id)
  if (!leaving) return

  const others = room.players.filter(p => p.id !== socket.id)
  if (others.length) io.to(roomId).emit('opponent_left', leaving.alias)

  room.players.forEach(p => io.sockets.sockets.get(p.id)?.leave(roomId))
  rooms.delete(roomId)
  sync(io)
}