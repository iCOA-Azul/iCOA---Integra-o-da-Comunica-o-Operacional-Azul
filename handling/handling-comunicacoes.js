
import { db, auth } from "../firebase.js";

import {
    collection,
    addDoc,
    onSnapshot,
    serverTimestamp,
    doc,
    updateDoc
} from "firebase/firestore";

import { onAuthStateChanged } from "firebase/auth";

// ========================================
// ELEMENTOS DO HTML
// ========================================

const listaMensagens = document.getElementById("listaMensagens");
const campoMensagem = document.getElementById("mensagem");
const formMensagem = document.getElementById("formMensagem");
const badgeCCO = document.getElementById("badgeCCO");
const botaoEnviar = document.getElementById("botaoEnviar");
const contadorComunicacoes = document.getElementById("contadorComunicacoes");

const SETOR = "Handling";
const DESTINATARIO = "CCO";

let usuarioAtual = null;
let todasMensagens = [];
let pararDeEscutar = null;
let conversaAberta = false;
let marcandoComoLidas = false;

// ========================================
// AUTENTICAÇÃO
// ========================================

onAuthStateChanged(auth, (usuario) => {
    if (!usuario) {
        window.location.href = "../index.html";
        return;
    }

    usuarioAtual = usuario;

    if (pararDeEscutar) {
        pararDeEscutar();
    }

    ouvirMensagens();
});

// ========================================
// RECEBER MENSAGENS DO FIREBASE
// ========================================

function ouvirMensagens() {
    pararDeEscutar = onSnapshot(
        collection(db, "comunicacoes"),
        (snapshot) => {
            todasMensagens = snapshot.docs.map((documento) => ({
                id: documento.id,
                ...documento.data()
            }));

            mostrarMensagens();
            atualizarNotificacao();

            if (conversaAberta) {
                marcarMensagensComoLidas();
            }
        },
        (erro) => {
            console.error("Erro ao carregar mensagens:", erro);

            if (listaMensagens) {
                listaMensagens.textContent =
                    "Não foi possível carregar as mensagens. Verifique as regras do Firebase.";
            }
        }
    );
}

// ========================================
// CONVERSA ENTRE HANDLING E CCO
// ========================================

function obterMensagensDaConversa() {
    return todasMensagens
        .filter((mensagem) => {
            return (
                (mensagem.remetente === SETOR &&
                    mensagem.destinatario === DESTINATARIO) ||
                (mensagem.remetente === DESTINATARIO &&
                    mensagem.destinatario === SETOR)
            );
        })
        .sort((a, b) => {
            const dataA = a.criadoEm?.toMillis?.() ?? 0;
            const dataB = b.criadoEm?.toMillis?.() ?? 0;

            return dataA - dataB;
        });
}

// ========================================
// MOSTRAR MENSAGENS
// ========================================

function mostrarMensagens() {
    if (!listaMensagens) return;

    listaMensagens.replaceChildren();

    const mensagens = obterMensagensDaConversa();

    if (mensagens.length === 0) {
        const vazio = document.createElement("div");
        vazio.className = "conversa-vazia";

        const icone = document.createElement("div");
        icone.className = "icone-vazio";
        icone.textContent = "💬";

        const titulo = document.createElement("h4");
        titulo.textContent = "Nenhuma mensagem";

        const descricao = document.createElement("p");
        descricao.textContent =
            "A comunicação com o CCO aparecerá aqui.";

        vazio.append(icone, titulo, descricao);
        listaMensagens.appendChild(vazio);

        return;
    }

    mensagens.forEach(criarMensagem);

    listaMensagens.scrollTop = listaMensagens.scrollHeight;
}

// ========================================
// CRIAR MENSAGEM
// ========================================

function criarMensagem(mensagem) {
    const elemento = document.createElement("div");

    const enviadaPorMim =
        mensagem.remetenteUid === usuarioAtual?.uid;

    elemento.classList.add(
        "mensagem",
        enviadaPorMim ? "mensagem-enviada" : "mensagem-recebida"
    );

    const remetente = document.createElement("strong");
    remetente.textContent = mensagem.remetente || "Setor";

    const texto = document.createElement("div");
    texto.textContent = mensagem.texto || "";

    const horario = document.createElement("small");

    if (mensagem.criadoEm?.toDate) {
        horario.textContent = mensagem.criadoEm
            .toDate()
            .toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit"
            });
    } else {
        horario.textContent = "Enviando...";
    }

    elemento.append(remetente, texto, horario);
    listaMensagens.appendChild(elemento);
}

// ========================================
// MARCAR MENSAGENS RECEBIDAS COMO LIDAS
// ========================================

async function marcarMensagensComoLidas() {
    if (!usuarioAtual || marcandoComoLidas) return;

    const naoLidas = obterMensagensDaConversa().filter((mensagem) => {
        return (
            mensagem.remetente === DESTINATARIO &&
            mensagem.destinatario === SETOR &&
            mensagem.lida !== true
        );
    });

    if (naoLidas.length === 0) return;

    marcandoComoLidas = true;

    try {
        for (const mensagem of naoLidas) {
            await updateDoc(
                doc(db, "comunicacoes", mensagem.id),
                { lida: true }
            );
        }
    } catch (erro) {
        console.error("Erro ao marcar mensagens como lidas:", erro);
    } finally {
        marcandoComoLidas = false;
    }
}

// ========================================
// ENVIAR MENSAGEM AO CCO
// ========================================

if (formMensagem) {
    formMensagem.addEventListener("submit", async (event) => {
        event.preventDefault();

        const texto = campoMensagem.value.trim();

        if (!texto || !usuarioAtual) return;

        botaoEnviar.disabled = true;

        try {
            await addDoc(collection(db, "comunicacoes"), {
                remetente: SETOR,
                remetenteUid: usuarioAtual.uid,
                destinatario: DESTINATARIO,
                texto: texto,
                criadoEm: serverTimestamp(),
                lida: false
            });

            campoMensagem.value = "";
            campoMensagem.focus();
        } catch (erro) {
            console.error("Erro ao enviar mensagem:", erro);

            alert(
                "Não foi possível enviar a mensagem. Verifique sua conexão e as regras do Firebase."
            );
        } finally {
            botaoEnviar.disabled = false;
        }
    });
}

// ========================================
// CONTADOR DE MENSAGENS NÃO LIDAS
// ========================================

function atualizarNotificacao() {
    const naoLidas = obterMensagensDaConversa().filter((mensagem) => {
        return (
            mensagem.remetente === DESTINATARIO &&
            mensagem.destinatario === SETOR &&
            mensagem.lida !== true
        );
    });

    const quantidade = naoLidas.length;

    if (contadorComunicacoes) {
        contadorComunicacoes.textContent = quantidade;
    }

    if (badgeCCO) {
        badgeCCO.textContent = quantidade > 0 ? quantidade : "";
    }
}

// ========================================
// DETECTAR ABERTURA DA CONVERSA
// ========================================

// Ao entrar na página de comunicações, a conversa
// é considerada aberta e as mensagens recebidas são lidas.
conversaAberta = true;

console.log("iCOA — Comunicação do Handling carregada.");
