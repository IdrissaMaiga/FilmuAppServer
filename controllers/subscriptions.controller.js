import prismaclient from "../lib/prisma.js"; // Assuming prisma client is imported like this

// Create a single subscription
export const createSubscription = async (req, res) => {
  try {
    const { price, devices, downloads, description, icon, badge, type } = req.body;

    // Only allow admin to create subscriptions
    if (!req.isAdmin) {
      return res.status(403).json({ message: 'Only admin can create a subscription' });
    }

    // Check if subscription type already exists
    const existingSubscription = await prismaclient.subscription.findFirst({
      where: { type },
    });

    if (existingSubscription) {
      return res.status(400).json({ message: 'Subscription with this type already exists' });
    }

    const newSubscription = await prismaclient.subscription.create({
      data: {
        price,
        devices,
        downloads,
        description,
        icon,
        badge,
        type,
      },
    });

    res.status(201).json({ message: 'Subscription created successfully', subscription: newSubscription });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to create subscription' });
  }
};

export const createBulkSubscriptions = async (req, res) => {
  try {
    const { subscriptions } = req.body; // Expect an array of subscription objects

    // Only allow admin to create subscriptions
    if (!req.isAdmin) {
      return res.status(403).json({ message: 'Only admin can create subscriptions' });
    }

    // Retrieve existing subscription types to avoid duplicates
    const existingTypes = await prismaclient.subscription.findMany({
      select: { type: true },
    });
    const existingTypeSet = new Set(existingTypes.map(sub => sub.type));

    // Filter out subscriptions that have a type already in use
    const newSubscriptionsData = subscriptions.filter(sub => !existingTypeSet.has(sub.type));

    // Bulk create subscriptions if there are any new ones
    if (newSubscriptionsData.length > 0) {
      const newSubscriptions = await prismaclient.subscription.createMany({
        data: newSubscriptionsData,
      });

      res.status(201).json({ message: 'Bulk subscriptions created successfully', created: newSubscriptions });
    } else {
      res.status(200).json({ message: 'No new unique subscription types to create' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to create bulk subscriptions' });
  }
};


export const updateSubscription = async (req, res) => {
  try {
    const {  id} = req.params;
    const { fieldName, fieldValue } = req.body;
    
    // Ensure that only valid fields can be updated
    const allowedFields = ["duration","type",'price', 'devices', 'downloads', 'description'];
    if (!allowedFields.includes(fieldName)) {
      return res.status(400).json({ message: 'Invalid field name' });
    }
    let  existingSubscription;
    if (fieldName=="type")
    existingSubscription= await prismaclient.subscription.findFirst({
      where: {type: fieldValue },
    });

    if (existingSubscription) {
      return res.status(400).json({ message: 'Subscription with this type already exists' });
    }

    // Only allow admin to update subscriptions
    if (!req.isAdmin) {
      return res.status(403).json({ message: 'Only admin can update a subscription' });
    }

    const updatedSubscription = await prismaclient.subscription.update({
      where: { id },
      data: { [fieldName]: fieldValue },
    });

    res.status(200).json({
      message: 'Subscription updated successfully',
      subscription: updatedSubscription,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to update subscription' });
  }
};


// Delete a subscription by ID
export const deleteSubscription = async (req, res) => {
  try {
    const { id } = req.params;

    // Only allow admin to delete subscriptions
    if (!req.isAdmin) {
      return res.status(403).json({ message: 'Only admin can delete a subscription' });
    }

    await prismaclient.subscription.delete({
      where: { id },
    });

    res.status(200).json({ message: 'Subscription deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to delete subscription' });
  }
};

// Get all subscriptions
export const getAllSubscriptions = async (req, res) => {
  try {
    const subscriptions = await prismaclient.subscription.findMany({select:{
      id: true,
      price: true,
      devices: true,
      downloads: true,
      description: true,
      type: true,
      duration: true,
      icon:true,
      badge:true
    }});

    // Update usercount based on the number of users in the users array
    const updatedSubscriptions = subscriptions.map(subscription => {
      const userCount = subscription.users ? subscription.users.length : 0; // Default to 0 if users is undefined
      return {
        ...subscription,

        usercount: userCount, // Update the usercount field
      };
    });

    res.status(200).json(updatedSubscriptions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to retrieve subscriptions' });
  }
};
