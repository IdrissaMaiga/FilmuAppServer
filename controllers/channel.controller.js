import prisma from '../lib/prisma.js';
import { encrypt, decrypt } from '../lib/crypto.js';
import prismaclient from '../lib/prisma.js';

// Create a new channel
export const createChannel = async (req, res) => {
  try {
    const { name, logos, total, category, ports } = req.body;

    // Only allow admin to create channels
    if (!req.isAdmin) {
      return res.status(403).json({ message: 'Only admin can create a channel' });
    }

    const encryptedPorts = ports.map(port => ({
      ...port,
      indexer: encrypt(port.indexer)
    }));

    const newChannel = await prisma.channel.create({
      data: {
        name,
        logos,
        total,
        category,
        ports: {
          create: encryptedPorts
        }
      }
    });

    res.status(201).json({
      message: 'Channel created successfully',
      channel: newChannel
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to create channel' });
  }
};

// Create multiple channels
export const createChannels = async (req, res) => {
  try {
    const { channels } = req.body;

    // Only allow admin to create channels
    if (!req.isAdmin) {
      return res.status(403).json({ message: 'Only admin can create channels' });
    }

    const createdChannels = [];
    const createdPorts = [];

    for (const channel of channels) {
      const { ports, ...channelData } = channel;
      const encryptedPorts = ports.map(port => ({
        ...port,
        indexer: encrypt(port.indexer)
      }));

      const createdChannel = await prisma.channel.create({
        data: {
          ...channelData,
          ports: {
            create: encryptedPorts
          }
        }
      });

      createdChannels.push(createdChannel);
      createdPorts.push(...encryptedPorts); // Collect created ports
    }

    res.status(201).json({
      message: 'Channels and ports created successfully',
      channels: createdChannels,
      ports: createdPorts
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to create channels' });
  }
};

// Import necessary modules and utilities


export const getChannels = async (req, res) => {
  try {
    const { page = 1, limit = 20, searchTerm = '', category = '' } = req.query;

    // Convert page and limit to integers for pagination
    const pageInt = parseInt(page, 10);
    const limitInt = parseInt(limit, 10);

    // Define filter conditions
    const where = {
      AND: [
        searchTerm ? { name: { contains: searchTerm, mode: 'insensitive' } } : {},
        category ? { category: category } : {},
      ],
    };

    // Fetch channels with pagination and search filters
    const channels = await prismaclient.channel.findMany({
      where,
      skip: (pageInt - 1) * limitInt,
      take: limitInt,
    });

    // Get the total count for pagination calculation
    const totalChannels = await prismaclient.channel.count({ where });

    res.status(200).json({
      channels,
      totalPages: Math.ceil(totalChannels / limitInt),
      currentPage: pageInt,
      totalItems: totalChannels,
    });
  } catch (error) {
    console.error('Error fetching channels:', error);
    res.status(500).json({ message: 'Failed to fetch channels' });
  }
};


// Get a channel by ID
export const getChannelById = async (req, res) => {
  try {
    const { id } = req.params;
    const channel = await prisma.channel.findUnique({
      where: { id },
      include: {
        ports: true
      }
    });

    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }

  //  const decryptedChannel = {
   //   ...channel,
   //   ports: channel.ports.map(port => ({
  //      ...port,
  //      indexer: decrypt(port.indexer)
   //   }))
   // };

  
    

    res.status(200).json(channel);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch channel' });
  }
};

// Update a channel by ID
export const updateChannel = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, logos,  total, category } = req.body;

    // Only allow admin to update channels
    if (!req.isAdmin) {
      return res.status(403).json({ message: 'Only admin can update a channel' });
    }

    const updatedChannel = await prisma.channel.update({
      where: { id },
      data: {
        name,
        logos,
        
        total,
        category
      }
    });

    res.status(200).json({
      message: 'Channel updated successfully',
      channel: updatedChannel
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to update channel' });
  }
};

// Delete a channel by ID
export const deleteChannel = async (req, res) => {
  try {
    const { id } = req.params;

    // Only allow admin to delete channels
    if (!req.isAdmin) {
      return res.status(403).json({ message: 'Only admin can delete a channel' });
    }

    await prisma.channel.delete({
      where: { id }
    });

    res.status(200).json({ message: 'Channel deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to delete channel' });
  }
};
