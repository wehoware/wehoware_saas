import supabase from '@/lib/supabase';

/**
 * Client model for interacting with client data
 */
export default class ClientModel {
  /**
   * Get all clients
   * 
   * @param {Object} options - Query options
   * @param {string} options.search - Search term for filtering clients
   * @param {boolean} options.active - Filter by active status
   * @param {string} options.sortBy - Field to sort by
   * @param {string} options.sortOrder - Sort direction ('asc' or 'desc')
   * @returns {Promise<Array>} - Array of client objects
   */
  static async getAll(options = {}) {
    const { search, active, sortBy = 'company_name', sortOrder = 'asc' } = options;
    
    let query = supabase.from('wehoware_clients').select('*');
    
    // Apply filters if provided
    if (active === true) {
      query = query.eq('active', true);
    }
    
    if (search) {
      query = query.or(`company_name.ilike.%${search}%,contact_person.ilike.%${search}%`);
    }
    
    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });
    
    const { data, error } = await query;
    
    if (error) {
      throw new Error(`Error fetching clients: ${error.message}`);
    }
    
    return data;
  }
  
  /**
   * Get a client by ID
   * 
   * @param {string} id - Client ID
   * @returns {Promise<Object>} - Client object
   */
  static async getById(id) {
    const { data, error } = await supabase
      .from('wehoware_clients')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      throw new Error(`Error fetching client: ${error.message}`);
    }
    
    return data;
  }
  
  /**
   * Create a new client
   * 
   * @param {Object} clientData - Client data
   * @returns {Promise<Object>} - Created client
   */
  static async create(clientData) {
    const { data, error } = await supabase
      .from('wehoware_clients')
      .insert([{
        ...clientData,
        created_at: new Date(),
        updated_at: new Date()
      }])
      .select();
    
    if (error) {
      throw new Error(`Error creating client: ${error.message}`);
    }
    
    return data[0];
  }
  
  /**
   * Update a client
   * 
   * @param {string} id - Client ID
   * @param {Object} clientData - Updated client data
   * @returns {Promise<Object>} - Updated client
   */
  static async update(id, clientData) {
    const { data, error } = await supabase
      .from('wehoware_clients')
      .update({
        ...clientData,
        updated_at: new Date()
      })
      .eq('id', id)
      .select();
    
    if (error) {
      throw new Error(`Error updating client: ${error.message}`);
    }
    
    return data[0];
  }
  
  /**
   * Delete a client
   * 
   * @param {string} id - Client ID
   * @returns {Promise<boolean>} - Success status
   */
  static async delete(id) {
    const { error } = await supabase
      .from('wehoware_clients')
      .delete()
      .eq('id', id);
    
    if (error) {
      throw new Error(`Error deleting client: ${error.message}`);
    }
    
    return true;
  }
  
  /**
   * Get clients for a specific user (for employees)
   * 
   * @param {string} userId - User ID
   * @returns {Promise<Array>} - Array of client objects
   */
  static async getClientsByUserId(userId) {
    const { data, error } = await supabase
      .from('wehoware_user_clients')
      .select('client_id, is_primary, wehoware_clients(*)')
      .eq('user_id', userId);
    
    if (error) {
      throw new Error(`Error fetching user clients: ${error.message}`);
    }
    
    return data.map(item => ({
      ...item.wehoware_clients,
      isPrimary: item.is_primary
    }));
  }
  
  /**
   * Assign a client to a user
   * 
   * @param {string} userId - User ID
   * @param {string} clientId - Client ID
   * @param {boolean} isPrimary - Whether this is the user's primary client
   * @returns {Promise<Object>} - Assignment record
   */
  static async assignClientToUser(userId, clientId, isPrimary = false) {
    // If setting as primary, first clear any existing primary
    if (isPrimary) {
      await supabase
        .from('wehoware_user_clients')
        .update({ is_primary: false })
        .eq('user_id', userId)
        .eq('is_primary', true);
    }
    
    // Check if assignment already exists
    const { data: existingData } = await supabase
      .from('wehoware_user_clients')
      .select('*')
      .eq('user_id', userId)
      .eq('client_id', clientId)
      .single();
    
    if (existingData) {
      // Update existing assignment
      const { data, error } = await supabase
        .from('wehoware_user_clients')
        .update({ is_primary: isPrimary, updated_at: new Date() })
        .eq('id', existingData.id)
        .select();
      
      if (error) {
        throw new Error(`Error updating client assignment: ${error.message}`);
      }
      
      return data[0];
    } else {
      // Create new assignment
      const { data, error } = await supabase
        .from('wehoware_user_clients')
        .insert([{
          user_id: userId,
          client_id: clientId,
          is_primary: isPrimary,
          created_at: new Date(),
          updated_at: new Date()
        }])
        .select();
      
      if (error) {
        throw new Error(`Error assigning client to user: ${error.message}`);
      }
      
      return data[0];
    }
  }
  
  /**
   * Remove a client assignment from a user
   * 
   * @param {string} userId - User ID
   * @param {string} clientId - Client ID
   * @returns {Promise<boolean>} - Success status
   */
  static async removeClientFromUser(userId, clientId) {
    const { error } = await supabase
      .from('wehoware_user_clients')
      .delete()
      .eq('user_id', userId)
      .eq('client_id', clientId);
    
    if (error) {
      throw new Error(`Error removing client from user: ${error.message}`);
    }
    
    return true;
  }
}
