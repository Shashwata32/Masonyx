import axios from 'axios';

const API_BASE = 'http://localhost:5000';

export const computeMasonGain = async (data) => {
  const response = await axios.post(`${API_BASE}/compute-transfer-function`, data);
  return response.data;
};
