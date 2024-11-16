import prismaclient from '../lib/prisma.js'

/**
 * Update a specific field in a model
 * @param {String} modelName - The name of the model to update
 * @param {Object} pointer - The pointer object to locate the record (e.g., { id: '123' })
 * @param {String} fieldName - The name of the field to update
 * @param {Any} fieldValue - The new value for the field
 * @returns {Object} - The updated record
 */
const updateAField = async (modelName, pointer, fieldName, fieldValue) => {
  try {
    const updateData = {}
    updateData[fieldName] = fieldValue

    const updatedRecord = await prismaclient[modelName].update({
      where: pointer,
      data: updateData
    })
    return updatedRecord
  } catch (error) {
    throw new Error(`Failed to update ${modelName}: ${error.message}`)
  }
}

export default updateAField
