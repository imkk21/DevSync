import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const JUDGE0_API_URL = process.env.JUDGE0_API_URL || 'https://judge0-ce.p.rapidapi.com';
const JUDGE0_API_KEY = process.env.JUDGE0_API_KEY;
const JUDGE0_API_HOST = process.env.JUDGE0_API_HOST || 'judge0-ce.p.rapidapi.com';

const headers = {
  'Content-Type': 'application/json',
};

if (JUDGE0_API_KEY) {
  headers['X-RapidAPI-Key'] = JUDGE0_API_KEY;
  headers['X-RapidAPI-Host'] = JUDGE0_API_HOST;
}

export async function submitCode(sourceCode, languageId, stdin = '') {
  try {
    const response = await axios.post(
      `${JUDGE0_API_URL}/submissions?base64_encoded=true&wait=false`,
      {
        source_code: Buffer.from(sourceCode).toString('base64'),
        language_id: languageId,
        stdin: stdin ? Buffer.from(stdin).toString('base64') : null,
      },
      { headers }
    );

    return response.data;
  } catch (error) {
    console.error('Judge0 submit error:', error.response?.data || error.message);
    throw new Error(
      JUDGE0_API_KEY
        ? 'Failed to submit code to Judge0'
        : 'Judge0 API key not configured. Add JUDGE0_API_KEY to your .env file (get one free at rapidapi.com/judge0-official/api/judge0-ce)'
    );
  }
}

export async function getSubmissionResult(token) {
  try {
    const response = await axios.get(
      `${JUDGE0_API_URL}/submissions/${token}?base64_encoded=true`,
      { headers }
    );

    return response.data;
  } catch (error) {
    console.error('Judge0 result error:', error.response?.data || error.message);
    return null;
  }
}
