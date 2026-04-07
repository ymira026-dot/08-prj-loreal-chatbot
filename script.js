/* DOM elements */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");

// System prompt for the chatbot.
const systemPrompt =
  "You are a L'Oréal beauty assistant. Only answer questions about L'Oréal products, beauty routines, skincare, makeup, haircare, fragrances, and product recommendations. If a question is unrelated, politely refuse and say you can only help with L'Oréal and beauty-related topics. Then invite the user to ask about products, routines, or recommendations.";

// Replace this with your deployed Cloudflare Worker URL.
// Example: https://your-worker-name.your-subdomain.workers.dev
const workerUrl =
  typeof CLOUDFLARE_WORKER_URL !== "undefined"
    ? CLOUDFLARE_WORKER_URL
    : "https://loreal-chatbot.ymira026.workers.dev/";

const chatHistory = [
  {
    role: "system",
    content: systemPrompt,
  },
];

// Stores user details and recent questions to support multi-turn context.
const userContext = {
  name: "",
  recentQuestions: [],
};

function appendMessage(role, text) {
  const messageElement = document.createElement("div");
  messageElement.classList.add("msg", role);
  messageElement.textContent = text;
  chatWindow.appendChild(messageElement);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function updateUserContext(message) {
  const lowerMessage = message.toLowerCase();

  // Basic name capture for phrases like "my name is Maya".
  const nameMatch = lowerMessage.match(/my name is\s+([a-z][a-z'\-]*)/i);
  if (nameMatch) {
    userContext.name =
      nameMatch[1].charAt(0).toUpperCase() + nameMatch[1].slice(1);
  }

  userContext.recentQuestions.push(message);
  if (userContext.recentQuestions.length > 5) {
    userContext.recentQuestions.shift();
  }
}

function buildContextPrompt() {
  const nameText = userContext.name
    ? `User name: ${userContext.name}.`
    : "User name: unknown.";

  const questionsText = userContext.recentQuestions.length
    ? `Recent user questions: ${userContext.recentQuestions.join(" | ")}`
    : "Recent user questions: none yet.";

  return `${nameText} ${questionsText} Use this context when it helps the response.`;
}

function showLatestQuestion(question) {
  const existingQuestion = chatWindow.querySelector(".latest-question");
  if (existingQuestion) {
    existingQuestion.remove();
  }

  const questionElement = document.createElement("div");
  questionElement.classList.add("latest-question");
  questionElement.textContent = `Latest question: ${question}`;
  chatWindow.appendChild(questionElement);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function setLoadingState(isLoading) {
  userInput.disabled = isLoading;
  chatForm.querySelector("button").disabled = isLoading;
}

// Set initial message
appendMessage(
  "ai",
  "👋 Hello! Ask me about L'Oréal products, routines, or recommendations.",
);

/* Handle form submit */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const message = userInput.value.trim();

  if (!message) {
    return;
  }

  if (workerUrl.includes("your-worker-name")) {
    appendMessage(
      "ai",
      "Please add your deployed Cloudflare Worker URL in script.js first.",
    );
    return;
  }

  appendMessage("user", message);
  updateUserContext(message);
  chatHistory.push({ role: "user", content: message });
  userInput.value = "";
  setLoadingState(true);

  try {
    const messagesForRequest = [
      { role: "system", content: systemPrompt },
      { role: "system", content: buildContextPrompt() },
      ...chatHistory.slice(1),
    ];

    // Send messages to your Cloudflare Worker.
    const response = await fetch(workerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: messagesForRequest,
      }),
    });

    if (!response.ok) {
      throw new Error("Cloudflare Worker request failed.");
    }

    const data = await response.json();
    const reply = data.choices[0].message.content;

    chatHistory.push({ role: "assistant", content: reply });
    showLatestQuestion(message);
    appendMessage("ai", reply);
  } catch (error) {
    appendMessage(
      "ai",
      "Sorry, I could not get a response right now. Please try again.",
    );
  } finally {
    setLoadingState(false);
    userInput.focus();
  }
});
