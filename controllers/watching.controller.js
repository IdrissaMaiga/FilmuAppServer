import prismaclient from '../lib/prisma.js'
import updateAField from '../functions/fieldUpdate.js'


// this will be for handle user watching json 



// Create a new watching record
export const createWatching = async (req, res) => {
  try {
    const { movieId, episodeId, time } = req.body
    const userId = req.user.id // Assuming user ID is stored in req.user

    // Validate that either movieId or episodeId is provided, but not both
    if ((movieId && episodeId) || (!movieId && !episodeId)) {
      return res
        .status(400)
        .json({ message: 'Provide either movieId or episodeId, but not both' })
    }

    // Check if the user already has a watching record for the same episode or movie
    const existingWatching = await prismaclient.watching.findFirst({
      where: {
        userId,
        OR: [
          { movieId: movieId ? movieId : undefined },
          { episodeId: episodeId ? episodeId : undefined }
        ]
      }
    })

    if (existingWatching) {
      return res.status(400).json({
        message: 'User already has a watching record for this episode or movie'
      })
    }

    // Create the new watching record
    const newWatching = await prismaclient.watching.create({
      data: {
        userId,
        movieId,
        episodeId,
        time
      },
      include: {
        movie: true,
        episode: true
      }
    })

    res.status(201).json({
      message: 'Watching record created successfully',
      watching: newWatching
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Failed to create watching record' })
  }
}

// Get the watching records of the logged-in user
export const getWatching = async (req, res) => {
  try {
    const userId = req.user.id // Assuming user ID is stored in req.user
    const { ForUIOrAll } = req.body

    let watching = await prismaclient.watching.findMany({
      where: { userId },
      include: {
        movie: true,
        episode: true
      },
      orderBy: {
        DateOfWatching: 'desc' // Assuming 'watchingDate' is the field for the watching date
      }
    })

    if (ForUIOrAll) {
      // Convert the map back to an array
      const watchMap = new Map()
      watching.forEach(record => {
        const seriesId = record.episode?.seriesId
        const movieId = record.movie?.id
        // Assuming 'seriesId' is a field in the episode model
        if (movieId) {
          watchMap.set(movieId, record)
        }
        if (!watchMap.has(seriesId)) {
          watchMap.set(seriesId, record)
        }
      })

      watching = Array.from(watchMap.values())
    }

    if (!watching || watching.length === 0) {
      return res
        .status(404)
        .json({ message: 'Watching records not found for the user' })
    }

    res.status(200).json(watching)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Failed to fetch watching records' })
  }
}

// Update the watching record of a user
export const updateWatching = async (req, res) => {
  try {
    const { movieId, episodeId, time } = req.body
    const userId = req.user.id // Logged-in user ID

    // Validate that either movieId or episodeId is provided, but not both
    if ((movieId && episodeId) || (!movieId && !episodeId)) {
      return res
        .status(400)
        .json({ message: 'Provide either movieId or episodeId, but not both' })
    }

    // Fetch the existing watching record for the specified user

    const existingWatching = await prismaclient.watching.findFirst({
      where: {
        userId,
        OR: [
          { movieId: movieId ? movieId : undefined },
          { episodeId: episodeId ? episodeId : undefined }
        ]
      },
      include: {
        movie: true,
        episode: true
      }
    })

    if (!existingWatching) {
      return res.status(404).json({ message: 'Watching record not found' })
    }

    // Prepare update data
    const updateData = {}
    if (movieId) updateData.movieId = movieId
    if (episodeId) updateData.episodeId = episodeId
    if (time !== undefined) {
      updateData.time = time
      updateData.DateOfWatching = new Date() // Set DateOfWatching to current timestamp
    }

    // Update the existing watching record
    const updatedWatching = await prismaclient.watching.update({
      where: { id: existingWatching.id },
      data: updateData,
      include: {
        movie: true,
        episode: true
      }
    })

    res.status(200).json({
      message: 'Watching record updated successfully',
      watching: updatedWatching
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Failed to update watching record' })
  }
}

// Delete the watching record of the logged-in user
export const deleteWatching = async (req, res) => {
  try {
    const { id } = req.params // Watching record ID to delete
    const userId = req.user.id // Assuming user ID is stored in req.user

    // Fetch the watching record for the logged-in user
    const existingWatching = await prismaclient.watching.findUnique({
      where: { id, userId },
      include: {
        movies: true,
        episode: true
      }
    })

    if (!existingWatching) {
      return res.status(404).json({ message: 'Watching record not found' })
    }

    // Delete the watching record
    await prismaclient.watching.delete({
      where: { id }
    })

    res.status(200).json({ message: 'Watching record deleted successfully' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Failed to delete watching record' })
  }
}
