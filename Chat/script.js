const chatInput = document.querySelector(".chat-input textarea");
const sendChatBtn = document.querySelector(".chat-input i");
const chatbox = document.querySelector(".chatbox");

let userMessage;
const API_KEY="";

const createChatLi = (message, className)=>{
    //Crea un chat <li> elemento con mensaje pasado y nombre de clase
    const chatLi = document.createElement("li");
    chatLi.classList.add("chat", className);
    let chatContent = className ==="outgoing" ?`<p>${message}</p>`:`<img class="paniImg" src="../IMG/paniquinosico.ico" alt=""><p>${message}</p>`;
    chatLi.innerHTML=chatContent;
    return chatLi;
}

const generateResponse=()=>{
    const API_URL = "https://api.openai.com/v1/chat/completions";

    const requestOptions ={
        method:"POST",
        headers: {
            "Content Type": "application/json",
            "Authorization":`Bearer ${API_KEY}`
        },
        body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: userMessage }]
        })
    }
} 

const handleChat = ()=>{
    userMessage=chatInput.value.trim();
    if(!userMessage)return;

    //pasamos el mensaje del usuario al chatbox
    chatbox.append(createChatLi(userMessage,"outgoing"));

    setTimeout(()=>{
        //desplegar mensaje de Cargando mientras que se cargue la respuesta
        chatbox.appendChild(createChatLi("Cargando...","incoming"));
        generateResponse();
    },600);
}

sendChatBtn.addEventListener("click",handleChat)