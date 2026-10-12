
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

// ======================================
// ELEMENTOS DA PÁGINA
// ======================================

const listaMensagens = document.getElementById("listaMensagens");
const campoMensagem = document.getElementById("mensagem");
const formMensagem = document.getElementById("formMensagem");
const badgeCCO = document.getElementById("badgeCCO");
const badgeMenu = document.getElementById("badgeMenu");
const botaoEnviar = document.getElementById("botaoEnviar");

const SETOR = "Comercial";
const DESTINATARIO = "CCO";

let usuarioAtual = null;
let todasMensagens = [];
let pararDeEscutar = null;
let marcandoComoLidas = false;

// ======================================
// NOTIFICAÇÕES
// ======================================

function atualizarNotificacao() {
    const naoLidas = todasMensagens.filter((mensagem) => {
        return (
            mensagem.remetente === DESTINATARIO &&
            mensagem.destinatario === SETOR &&
            mensagem.lida !== true
        );
    });

    const quantidade = naoLidas.length;

    [badgeCCO, badgeMenu].forEach((badge) => {
        if (!badge) return;

        badge.textContent = quantidade > 0
            ? String(quantidade)
            : "";

        badge.style.display = quantidade > 0
            ? "inline-flex"
            : "none";
    });
}

// ======================================
// LOGIN
// ======================================

onAuthStateChanged(auth, (usuario) => {
    if (!usuario) {
        if (pararDeEscutar) {
            pararDeEscutar();
            pararDeEscutar = null;
        }

        window.location.href = "../index.html";
        return;
    }

    usuarioAtual = usuario;

    if (pararDeEscutar) {
        pararDeEscutar();
    }

    ouvirMensagens();
});

// ======================================
// ESCUTAR FIRESTORE EM TEMPO REAL
// ======================================

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

            marcarMensagensComoLidas();
        },

        (erro) => {
            console.error("Erro ao carregar mensagens:", erro);

            if (listaMensagens) {
                listaMensagens.textContent =
                    "Não foi possível carregar as mensagens. Verifique a conexão e as regras do Firebase.";
            }
        }
    );
}

// ======================================
// FILTRAR CONVERSA COM O CCO
// ======================================

function obterMensagensDaConversa() {
    return todasMensagens
        .filter((mensagem) => {
            return (
                (
                    mensagem.remetente === SETOR &&
                    mensagem.destinatario === DESTINATARIO
                ) ||
                (
                    mensagem.remetente === DESTINATARIO &&
                    mensagem.destinatario === SETOR
                )
            );
        })
        .sort((a, b) => {
            const dataA = a.criadoEm?.toMillis?.() ?? 0;
            const dataB = b.criadoEm?.toMillis?.() ?? 0;

            return dataA - dataB;
        });
}

// ======================================
// MOSTRAR MENSAGENS
// ======================================

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

// ======================================
// CRIAR MENSAGEM
// ======================================

function criarMensagem(mensagem) {
    const elemento = document.createElement("div");

    const enviadaPorMim =
        mensagem.remetenteUid === usuarioAtual?.uid;

    elemento.classList.add(
        "mensagem",
        enviadaPorMim
            ? "mensagem-enviada"
            : "mensagem-recebida"
    );

    const remetente = document.createElement("strong");
    remetente.textContent = mensagem.remetente || "Setor";

    const texto = document.createElement("div");
    texto.className = "texto-mensagem";
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

// ======================================
// ENVIAR MENSAGEM
// ======================================

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
                "Não foi possível enviar a mensagem. Confira a conexão e as regras do Firebase."
            );

        } finally {
            botaoEnviar.disabled = false;
        }
    });
}

// ======================================
// MARCAR MENSAGENS RECEBIDAS COMO LIDAS
// ======================================

async function marcarMensagensComoLidas() {
    if (!usuarioAtual || marcandoComoLidas) return;

    const pendentes = obterMensagensDaConversa().filter((mensagem) => {
        return (
            mensagem.remetente === DESTINATARIO &&
            mensagem.destinatario === SETOR &&
            mensagem.lida !== true
        );
    });

    if (pendentes.length === 0) {
        atualizarNotificacao();
        return;
    }

    marcandoComoLidas = true;

    try {
        for (const mensagem of pendentes) {
            await updateDoc(
                doc(db, "comunicacoes", mensagem.id),
                { lida: true }
            );

            const mensagemLocal = todasMensagens.find(
                (item) => item.id === mensagem.id
            );

            if (mensagemLocal) {
                mensagemLocal.lida = true;
            }
        }

        atualizarNotificacao();

    } catch (erro) {
        console.error(
            "Erro ao marcar mensagens como lidas:",
            erro
        );

        alert(
            "Não foi possível marcar as mensagens como lidas. Verifique o erro no Console do navegador (F12)."
        );

    } finally {
        marcandoComoLidas = false;
    }
}

console.log("iCOA — Comunicação do Comercial carregada.");
