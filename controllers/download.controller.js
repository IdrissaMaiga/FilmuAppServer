import prismaclient from '../lib/prisma.js'
// Get all downloads of the logged-in user
export const getDownloads = async (req, res) => {
  try {
    const userId = req.user.id // Assuming user ID is stored in req.user

    // Fetch the downloads for the logged-in user
    const downloads = await prismaclient.downloads.findMany({
      where: { userId },
      include: {
        movie: true,
        episode: true
      }
    })

    res.status(200).json(downloads)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Failed to fetch downloads' })
  }
}
