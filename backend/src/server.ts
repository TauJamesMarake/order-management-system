import app from './app'
import dotenv from 'dotenv'

dotenv.config()

const PORT = parseInt(process.env.PORT || '5000', 10)

const server = app.listen(PORT, () => {
  console.log(`\n API running`)
  console.log(`   Environment : ${process.env.NODE_ENV || 'development'}`)
  console.log(`   Port        : ${PORT}`)
  console.log(`   Health      : http://localhost:${PORT}/health\n`)
})

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...')
  server.close(() => {
    console.log('Server closed.')
    process.exit(0)
  })
})
