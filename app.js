import express from 'express'
import cors from 'cors'
import env from 'dotenv'
env.config()
import cookieParser from 'cookie-parser'
import authRoute from './routes/auth.route.js'
import profileRoute from './routes/userprofile.route.js'
import tasteRoute from './routes/taste.route.js'
import watchingRoute from './routes/watching.route.js'
import downloadRoute from './routes/download.route.js'
import movieRoute from './routes/movie.route.js'
import SerieRouter from './routes/serie.router.js'
import portRoute from './routes/port.route.js'
import channelRoute from './routes/channel.route.js'
const app = express()
import bodyParser from 'body-parser'
import transactionRoute from './routes/transaction.route.js'
import subscriptionRoute from './routes/subscriptions.router.js'

// Increase the limit for JSON payloads
app.use(bodyParser.json({ limit: '50mb' })) // Adjust '50mb' to the desired size



app.use(express.json())

const corsOptions = {
  origin: '*',  // Allow all origins (use with caution in production)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Allow the necessary methods
  allowedHeaders: ['Content-Type', 'Authorization'], // Allow these headers
  //credentials: true, // Optional: Allows cookies to be sent
};

// Apply CORS middleware globally
app.use(cors(corssetting));
//app.options('*', cors(corssetting)); 
//app.use(cookieParser())


app.use('/api/auth', authRoute)

app.use('/api/user', profileRoute)

app.use('/api/subscription', subscriptionRoute);

app.use('/api/transaction',transactionRoute)

app.use('/api/channels', channelRoute)

app.use('/api/port', portRoute)

app.use('/api/series', SerieRouter)

app.use('/api/taste', tasteRoute)

app.use('/api/transaction', transactionRoute)

app.use('/api/download', downloadRoute)

app.use('/api/movie', movieRoute)

app.use('/api/watching', watchingRoute)


app.listen(4000,'0.0.0.0', () => {
  console.log('Server is running!')
})
