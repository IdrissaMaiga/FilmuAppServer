import prisma from '../lib/prisma.js'
import { encrypt, decrypt } from '../lib/crypto.js'

// Create a new port
export const createPort = async (req, res) => {
  try {
    const { region, name, resolution, utc, indexer, channelId } = req.body

    // Only allow admin to create ports
    if (!req.isAdmin) {
      return res.status(403).json({ message: 'Only admin can create a port' })
    }

    const encryptedIndexer = encrypt(indexer)

    const newPort = await prisma.port.create({
      data: {
        region,
        name,
        resolution,
        utc,
        indexer: encryptedIndexer,
        Channel: {
          connect: { id: channelId }
        }
      }
    })

    res
      .status(201)
      .json({ message: 'Port created successfully', port: newPort })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Failed to create port' })
  }
}

// Create multiple ports
export const createPorts = async (req, res) => {
  try {
    const { ports } = req.body

    // Only allow admin to create ports
    if (!req.isAdmin) {
      return res.status(403).json({ message: 'Only admin can create ports' })
    }

    const portsData = ports.map(port => ({
      region: port.region,
      name: port.name,
      resolution: port.resolution,
      utc: port.utc,
      indexer: encrypt(port.indexer),
      channelId: port.channelId
    }))

    const createdPorts = await prisma.port.createMany({
      data: portsData
    })

    res
      .status(201)
      .json({ message: 'Ports created successfully', ports: createdPorts })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Failed to create ports' })
  }
}

// Get all ports
export const getPorts = async (req, res) => {
  try {
    const ports = await prisma.port.findMany({
      include: {
        Channel: true
      }
    })

   // const decryptedPorts = ports.map(port => ({
    //  ...port,
   //   indexer: decrypt(port.indexer)
    //}))


    res.status(200).json( ports);
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Failed to fetch ports' })
  }
}

// Get a port by ID
export const getPortById = async (req, res) => {
  try {
    
    const { id } = req.params
    
    const port = await prisma.port.findUnique({
      where: { id },
    })
   // console.log(id)
    if (!port) {
      return res.status(404).json({ message: 'Port not found' })
    }

    port.indexer = decrypt(port.indexer)
    res.status(200).json(port)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Failed to fetch port' })
  }
}



// Update a port by ID
export const updatePort = async (req, res) => {
  try {
    const { id } = req.params
    const { region, name, resolution, utc, indexer, channelId } = req.body

    // Only allow admin to update ports
    if (!req.isAdmin) {
      return res.status(403).json({ message: 'Only admin can update a port' })
    }

    const updatedData = {
      region,
      name,
      resolution,
      utc,
      Channel: {
        connect: { id: channelId }
      }
    }

    if (indexer) {
      updatedData.indexer = encrypt(indexer)
    }

    const updatedPort = await prisma.port.update({
      where: { id },
      data: updatedData
    })

    res
      .status(200)
      .json({ message: 'Port updated successfully', port: updatedPort })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Failed to update port' })
  }
}

// Delete a port by ID
export const deletePort = async (req, res) => {
  try {
    const { id } = req.params

    // Only allow admin to delete ports
    if (!req.isAdmin) {
      return res.status(403).json({ message: 'Only admin can delete a port' })
    }

    await prisma.port.delete({
      where: { id }
    })

    res.status(200).json({ message: 'Port deleted successfully' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Failed to delete port' })
  }
}
