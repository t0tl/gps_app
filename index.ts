import { readFile, writeFile } from "fs/promises";

// Facebook Messenger whitelists this localhost port so is the only one you can currently use
const PORT = 3103;

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',  // More permissive for development
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
};

const server = Bun.serve({
  port: PORT,
  fetch(request) {
    // Handle CORS preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS
      });
    }

    const url = new URL(request.url);
    switch (url.pathname) {
      case "/api/gpt-4-vision":
        console.log("GPT4 Vision Request");
        return handleVisionRequest(request);
      case "/api/status":
        console.log("API Status Request");
        return new Response("Server Up!", { 
          status: 200,
          headers: CORS_HEADERS
        });
      default:
        console.log("Not Found Request");
        return new Response("Not Found", { 
          status: 404,
          headers: CORS_HEADERS
        });
    }
  },
});

async function handleVisionRequest(request: Request) {
  if (request.method !== "POST" || request.headers.get("Content-Type") !== "application/json") {
    console.log("Invalid request", request.method, request.headers.get("Content-Type"));
    return new Response("Invalid request", { 
      status: 400,
      headers: CORS_HEADERS
    });
  }

  try {
    const imageUrl = (await request.json()).imageUrl;
    const responseContent = await analyzeImage(imageUrl);
    await saveData(imageUrl, responseContent);
    return new Response(JSON.stringify(responseContent), { 
      status: 200, 
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { 
      status: 500,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json"
      }
    });
  }
}

async function analyzeImage(imageUrl: string) {
  // Hash the image URL and if it's already hashed, use the cached response
  const hashedImageUrl = crypto.createHash('sha256').update(imageUrl).digest('hex');
  const cachedResponse = await readFile(`./${hashedImageUrl}.json`, "utf8");
  if (cachedResponse) {
    return cachedResponse;
  }

  const token = process.env.OPENAI_API_KEY;
  console.log("Token", token);
  const body = {
    model: GPT_VISION_MODEL,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: PRE_PROMPT },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
  };
  console.log("Sending request to GPT4 Vision");
  const response = await fetch(COMPLETIONS_ENDPOINT, {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    console.log("Request Failed");
    throw new Error(`API request failed with status: ${response.status}`);
  }

  console.log("Request Successful");
  const data = await response.json();

  // Save the response to the cache
  await writeFile(`./public/cached_responses/${hashedImageUrl}.json`, JSON.stringify(data));
  return data.choices[0].message.content;
}

// Pseudo database via a JSON file
async function saveData(imageUrl: string, description: string) {
  console.log("Saving data");
  const createdObject = { time: new Date().toISOString(), imageDescription: description, imageUrl };
  try {
    let data = [];
    try {
      console.log("Reading stored data");
      const storedData = await readFile(SAVED_DATA, "utf8");
      data = JSON.parse(storedData);
    } catch (readError) {
      // If the file doesn't exist, we'll create a new one
      console.log("Creating new data file.");
    }
    data.push(createdObject);
    console.log("Writing new data");
    await writeFile(SAVED_DATA, JSON.stringify(data));
  } catch (writeError) {
    throw new Error(`Failed to write to file: ${writeError}`);
  }
}

console.log(`Listening on localhost:${server.port}`);
