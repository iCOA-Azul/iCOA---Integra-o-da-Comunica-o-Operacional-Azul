




/*
const formulario = document.querySelector("form");

formulario.addEventListener("submit", function(event) {


event.preventDefault();

const usuario = document.getElementById("usuario").value;
const senha = document.getElementById("senha").value;


// LOGIN DO CCO

if (usuario === "cco" && senha === "1234") {

    window.location.href = "CCO/CCO.html";

} else {

    alert("Usuário ou senha incorretos.");

}


});







/* atual*

const formulario = document.querySelector("form");

formulario.addEventListener("submit", function(event) {


event.preventDefault();

const usuario = document.getElementById("usuario").value;
const senha = document.getElementById("senha").value;


// LOGIN DO CCO

if (usuario === "cco" && senha === "1234") {

    window.location.href = "CCO/CCO.html";

    return;
}


// LOGIN DA MANUTENÇÃO

if (usuario === "manutencao" && senha === "1234") {

    window.location.href = "MANUTENCAO/MANUTENCAO.html";

    return;
}



// LOGIN DA handling

if (usuario === "handling" && senha === "1234") {

    window.location.href = "handling/handling.html";

    return;
}



// LOGIN DA comercial

if (usuario === "comercial" && senha === "1234") {

    window.location.href = "comercial/comercial.html";

    return;
}




// LOGIN Do atendimento

if (usuario === "atendimento" && senha === "1234") {

    window.location.href = "atendimento/atendimento.html";

    return;
}



// LOGIN INCORRETO

alert("Usuário ou senha incorretos.");


});
*/



import { auth } from "./firebase.js";
import { signInWithEmailAndPassword } from "firebase/auth";

const formulario = document.querySelector("form");
const campoUsuario = document.getElementById("usuario");
const campoSenha = document.getElementById("senha");
const botaoEntrar = formulario.querySelector('button[type="submit"]');

const paginasSetores = {
  "cco@icoa.com": "CCO/CCO.html",
  //"manutencao@icoa.com": "MANUTENCAO/MANUTENCAO.html",
  "manutencao@icoa.com": "manutencao/manutencao.html",
  "handling@icoa.com": "handling/handling.html",
  "comercial@icoa.com": "comercial/comercial.html",
  "atendimento@icoa.com": "atendimento/atendimento.html"
};

formulario.addEventListener("submit", async function (event) {
  event.preventDefault();

  const email = campoUsuario.value.trim().toLowerCase();
  const senha = campoSenha.value;

  if (!email || !senha) {
    alert("Preencha o e-mail e a senha.");
    return;
  }

  botaoEntrar.disabled = true;
  botaoEntrar.textContent = "Entrando...";

  try {
    const resultado = await signInWithEmailAndPassword(
      auth,
      email,
      senha
    );

    const emailAutenticado = resultado.user.email
      .toLowerCase();

    const pagina = paginasSetores[emailAutenticado];

    if (!pagina) {
      await auth.signOut();
      alert("Este usuário não possui um setor configurado.");
      return;
    }

    window.location.href = pagina;

  } catch (erro) {
    console.error("Erro no login:", erro);

    alert("E-mail ou senha incorretos. Confira os dados e tente novamente.");

  } finally {
    botaoEntrar.disabled = false;
    botaoEntrar.textContent = "Entrar";
  }
});


