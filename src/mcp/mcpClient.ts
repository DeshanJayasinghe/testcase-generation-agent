import axios from 'axios';

const API_BASE_URL = 'https://api.example.com'; // Replace with actual API base URL

export const mcpClient = {
  async fetchData(endpoint: string, params?: Record<string, any>) {
    try {
      const response = await axios.get(`${API_BASE_URL}/${endpoint}`, { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching data:', error);
      throw error;
    }
  },

  async postData(endpoint: string, data: Record<string, any>) {
    try {
      const response = await axios.post(`${API_BASE_URL}/${endpoint}`, data);
      return response.data;
    } catch (error) {
      console.error('Error posting data:', error);
      throw error;
    }
  },

  // Additional methods for interacting with external services can be added here
};