const chatInput = document.querySelector(".chat-input textarea");
const sendChatBtn = document.querySelector(".chat-input i");
const chatbox = document.querySelector(".chatbox");
const chatbotCloseBtn = document.querySelector(".close-btn");
const chatbotToggler = document.querySelector(".chatbot-toggler");


let userMessage;
const API_KEY="";
const inputIniHeight = chatInput.scrollHeight;

const createChatLi = (message, className)=>{
    //Crea un chat <li> elemento con mensaje pasado y nombre de clase
    const chatLi = document.createElement("li");
    chatLi.classList.add("chat", className);
    let chatContent = className ==="outgoing" ?`<p></p>`:`<img class="paniImg" src="../IMG/paniquinosico.ico" alt=""><p></p>`;
    chatLi.innerHTML=chatContent;
    chatLi.querySelector("p").textContent = message;
    return chatLi;
}

const generateResponse=(incomingChatLi)=>{
    const API_URL = "https://api.openai.com/v1/chat/completions";
    const messageElement= incomingChatLi.querySelector("p")

    const requestOptions ={
        method:"POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization":`Bearer ${API_KEY}`
        },
        body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: userMessage }]
        })
    }

    //aca enviamos una solicitud POST a la API y obtiene una respuesta.
    //se paga </3

    fetch(API_URL,requestOptions).then(res => res.json()).then(data => {
        messageElement.textContent = data.choices[0].message.content;
    }).catch((error) => {
        messageElement.textContent = "Oops, por favor intenta de nuevo";
    }).finally(()=>chatbox.scrollTo(0, chatbox.scrollHeight));
} 

const handleChat = ()=>{
    userMessage=chatInput.value.trim();
    if(!userMessage)return;
    chatInput.value="";
    chatInput.style.height=`${inputIniHeight}px`;

    //pasamos el mensaje del usuario al chatbox
    chatbox.append(createChatLi(userMessage,"outgoing"));
    chatbox.scrollTo(0, chatbox.scrollHeight);

    setTimeout(()=>{
        //desplegar mensaje de Cargando mientras que se cargue la respuesta
        const incomingChatLi = createChatLi("Cargando...","incoming")
        chatbox.appendChild(incomingChatLi);
        chatbox.scrollTo(0, chatbox.scrollHeight);
        generateResponse(incomingChatLi);

    },600);
}
//ajustar el alto cuando scroleamos
chatInput.addEventListener("input",()=>{
    chatInput.style.height=`${inputIniHeight}px`;
    chatInput.style.height=`${chatInput.scrollHeight}px`;
})
//enviar con enter
chatInput.addEventListener("keydown",(e)=>{
    if(e.key === "Enter" && !e.shiftkey && Window.innerWidth > 800){
        e.preventDefault();
        handleChat();
    }
})

sendChatBtn.addEventListener("click",handleChat);
//para mostrar y ocultar nuestro chat
chatbotToggler.addEventListener("click",()=>  document.body.classList.toggle("show-chatbot"));
chatbotCloseBtn.addEventListener("click",()=> document.body.classList.remove("show-chatbot"));  