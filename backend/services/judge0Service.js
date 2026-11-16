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

const b64 = (s) => (s ? Buffer.from(s).toString('base64') : null);
const unb64 = (s) => (s ? Buffer.from(s, 'base64').toString('utf-8') : null);
const FIELDS = 'token,stdout,stderr,compile_output,status,time,memory';

// `additionalFiles`: base64 zip of the workspace's other files, unpacked next to the program
function submission(sourceCode, languageId, stdin, { args, additionalFiles } = {}) {
  return {
    source_code: b64(sourceCode),
    language_id: languageId,
    stdin: b64(stdin),
    command_line_arguments: args || null,
    additional_files: additionalFiles || null,
  };
}

function submitError(error) {
  console.error('Judge0 submit error:', error.response?.data || error.message);
  return new Error(
    JUDGE0_API_KEY
      ? 'Failed to submit code to Judge0'
      : 'Judge0 API key not configured. Add JUDGE0_API_KEY to your .env file (get one free at rapidapi.com/judge0-official/api/judge0-ce)'
  );
}

export async function submitCode(sourceCode, languageId, stdin = '', options) {
  try {
    const response = await axios.post(
      `${JUDGE0_API_URL}/submissions?base64_encoded=true&wait=false`,
      submission(sourceCode, languageId, stdin, options),
      { headers }
    );
    return response.data;
  } catch (error) {
    throw submitError(error);
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

// Decoded result: { stdout, stderr, compile_output, status, time, memory }
export function decodeResult(result) {
  return {
    stdout: unb64(result.stdout),
    stderr: unb64(result.stderr),
    compile_output: unb64(result.compile_output),
    status: result.status,
    time: result.time,
    memory: result.memory,
  };
}

// The same program against several inputs at once. Resolves decoded results in input order,
// or null for any that didn't finish in time.
export async function runBatch(sourceCode, languageId, inputs, options, { attempts = 20 } = {}) {
  let tokens;
  try {
    const { data } = await axios.post(
      `${JUDGE0_API_URL}/submissions/batch?base64_encoded=true`,
      { submissions: inputs.map((stdin) => submission(sourceCode, languageId, stdin, options)) },
      { headers }
    );
    tokens = data.map((d) => d.token);
  } catch (error) {
    throw submitError(error);
  }

  const results = new Map();
  for (let i = 0; i < attempts && results.size < tokens.length; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const pending = tokens.filter((t) => !results.has(t));
    try {
      const { data } = await axios.get(
        `${JUDGE0_API_URL}/submissions/batch?tokens=${pending.join(',')}&base64_encoded=true&fields=${FIELDS}`,
        { headers }
      );
      for (const r of data.submissions) if (r?.status?.id > 2) results.set(r.token, decodeResult(r));
    } catch (error) {
      console.error('Judge0 batch result error:', error.response?.data || error.message);
    }
  }
  return tokens.map((t) => results.get(t) ?? null);
}
