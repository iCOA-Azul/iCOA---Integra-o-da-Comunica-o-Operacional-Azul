
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

const botoesAreas = document.querySelectorAll(".area-comunicacao-item");
const listaMensagens = document.getElementById("listaMensagens");
const nomeArea = document.getElementById("nomeArea");
const descricaoArea = document.getElementById("descricaoArea");
const iconeConversa = document.getElementById("iconeConversa");
const campoMensagem = document.getElementById("mensagem");
const formMensagem = document.getElementById("formMensagem");
const botaoEnviar = document.getElementById("botaoEnviar");
const informacaoMensagem = document.getElementById("informacaoMensagem");

// ========================================
// VARIÁVEIS
// ========================================

let areaSelecionada = null;
let usuarioAtual = null;
let todasMensagens = [];
let pararDeEscutar = null;
let enviando = false;
let marcandoLeitura = false;

// ========================================
// ÁREAS E ÍCONES
// ========================================

const iconesAreas = {
    "CCO": "🖥️",
    "Manutenção": "🔧",
    "Atendimento": "🎧",
    "Handling": "🧳",
    "Comercial": "💼"
};

const descricoesAreas = {
    "Manutenção": "Comunicação com o setor de Manutenção.",
    "Atendimento": "Comunicação com o setor de Atendimento.",
    "Handling": "Comunicação com o setor de Handling.",
    "Comercial": "Comunicação com o setor Comercial."
};

const nomesBadges = {
    "Manutenção": "badgeManutencao",
    "Atendimento": "badgeAtendimento",
    "Handling": "badgeHandling",
    "Comercial": "badgeComercial"
};

// ========================================
// IDENTIFICAR O SETOR PELO E-MAIL
// ========================================

function identificarSetor(usuario) {
    const email = (usuario.email || "").trim().toLowerCase();

    const setores = {
        "cco@icoa.com": "CCO",
        "manutencao@icoa.com": "Manutenção",
        "handling@icoa.com": "Handling",
        "comercial@icoa.com": "Comercial",
        "atendimento@icoa.com": "Atendimento"
    };

    return setores[email] || null;
}

// ========================================
// FORMATAR HORA
// ========================================

function formatarHora(data) {
    if (!data) return "Enviando...";

    const dataReal = typeof data.toDate === "function"
        ? data.toDate()
        : new Date(data);

    if (Number.isNaN(dataReal.getTime())) {
        return "Horário indisponível";
    }

    return dataReal.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit"
    });
}

// ========================================
// MARCAR MENSAGENS RECEBIDAS COMO LIDAS
// ========================================

async function marcarMensagensComoLidas() {
    if (
        !usuarioAtual ||
        !areaSelecionada ||
        usuarioAtual.setor !== "CCO" ||
        marcandoLeitura
    ) {
        return;
    }

    const mensagensNaoLidas = todasMensagens.filter((mensagem) => {
        return (
            mensagem.destinatario === "CCO" &&
            mensagem.remetente === areaSelecionada &&
            mensagem.lida !== true
        );
    });

    if (mensagensNaoLidas.length === 0) return;

    marcandoLeitura = true;

    try {
        await Promise.all(
            mensagensNaoLidas.map((mensagem) =>
                updateDoc(doc(db, "comunicacoes", mensagem.id), {
                    lida: true
                })
            )
        );
    } catch (erro) {
        console.error("Erro ao marcar mensagens como lidas:", erro);
        informacaoMensagem.textContent =
            "Não foi possível atualizar a leitura. Verifique as regras do Firestore.";
    } finally {
        marcandoLeitura = false;
    }
}

// ========================================
// SELECIONAR UMA ÁREA
// ========================================

botoesAreas.forEach((botao) => {
    botao.addEventListener("click", () => {
        areaSelecionada = botao.dataset.area;

        botoesAreas.forEach((item) => {
            item.classList.remove("ativo", "selecionada");
        });

        botao.classList.add("ativo");

        nomeArea.textContent = areaSelecionada;
        descricaoArea.textContent =
            descricoesAreas[areaSelecionada] || "";

        iconeConversa.textContent =
            iconesAreas[areaSelecionada] || "💬";

        const eOutroSetor =
            usuarioAtual &&
            areaSelecionada !== usuarioAtual.setor;

        campoMensagem.disabled = !eOutroSetor;
        botaoEnviar.disabled = !eOutroSetor;

        informacaoMensagem.textContent = eOutroSetor
            ? "Enviando como " + usuarioAtual.setor
            : "Selecione outro setor para conversar.";

        mostrarMensagens();
        marcarMensagensComoLidas();
    });
});

// ========================================
// OBTER MENSAGENS DA CONVERSA SELECIONADA
// ========================================

function obterMensagensDaConversa() {
    if (!areaSelecionada) return [];

    return todasMensagens
        .filter((mensagem) => {
            return (
                (
                    mensagem.remetente === "CCO" &&
                    mensagem.destinatario === areaSelecionada
                ) ||
                (
                    mensagem.remetente === areaSelecionada &&
                    mensagem.destinatario === "CCO"
                )
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
    listaMensagens.innerHTML = "";

    if (!areaSelecionada) {
        mostrarConversaVazia(
            "Nenhuma conversa selecionada",
            "Selecione uma área ao lado para visualizar as mensagens."
        );
        return;
    }

    const mensagens = obterMensagensDaConversa();

    if (mensagens.length === 0) {
        mostrarConversaVazia(
            "Nenhuma mensagem",
            "Envie uma mensagem para iniciar a comunicação com " +
                areaSelecionada + "."
        );
        return;
    }

    mensagens.forEach((mensagem) => {
        criarMensagem(mensagem);
    });

    listaMensagens.scrollTop = listaMensagens.scrollHeight;
}

// ========================================
// CONVERSA VAZIA
// ========================================

function mostrarConversaVazia(titulo, descricao) {
    const vazio = document.createElement("div");
    vazio.classList.add("conversa-vazia");

    const icone = document.createElement("div");
    icone.classList.add("icone-vazio");
    icone.textContent = "💬";

    const tituloElemento = document.createElement("h4");
    tituloElemento.textContent = titulo;

    const descricaoElemento = document.createElement("p");
    descricaoElemento.textContent = descricao;

    vazio.append(icone, tituloElemento, descricaoElemento);
    listaMensagens.appendChild(vazio);
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

    const hora = document.createElement("small");
    hora.textContent = formatarHora(mensagem.criadoEm);

    elemento.append(remetente, texto, hora);
    listaMensagens.appendChild(elemento);
}

// ========================================
// ENVIAR MENSAGEM
// ========================================

formMensagem.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!usuarioAtual || enviando) return;

    if (!areaSelecionada) {
        alert("Selecione um setor para enviar a mensagem.");
        return;
    }

    if (areaSelecionada === usuarioAtual.setor) {
        alert("Selecione outro setor para enviar a mensagem.");
        return;
    }

    const texto = campoMensagem.value.trim();

    if (!texto) return;

    enviando = true;
    botaoEnviar.disabled = true;

    try {
        await addDoc(collection(db, "comunicacoes"), {
            remetente: usuarioAtual.setor,
            remetenteUid: usuarioAtual.uid,
            destinatario: areaSelecionada,
            texto: texto,
            criadoEm: serverTimestamp(),
            lida: false
        });

        campoMensagem.value = "";
        campoMensagem.focus();

    } catch (erro) {
        console.error("Erro ao enviar mensagem:", erro);

        alert(
            "Não foi possível enviar a mensagem. " +
            "Confira as regras do Firestore e sua conexão."
        );
    } finally {
        enviando = false;

        botaoEnviar.disabled =
            !usuarioAtual ||
            !areaSelecionada ||
            areaSelecionada === usuarioAtual.setor;
    }
});

// ========================================
// ATUALIZAR CONTADORES LATERAIS
// ========================================

function atualizarBadges() {
    Object.keys(nomesBadges).forEach((area) => {
        const badge = document.getElementById(nomesBadges[area]);

        if (!badge) return;

        const quantidade = todasMensagens.filter((mensagem) => {
            return (
                mensagem.remetente === area &&
                mensagem.destinatario === "CCO" &&
                mensagem.lida !== true
            );
        }).length;

        badge.textContent = quantidade > 0 ? quantidade : "";
        badge.style.display = quantidade > 0 ? "inline-flex" : "none";
    });
}

// ========================================
// LOGIN E ATUALIZAÇÃO EM TEMPO REAL
// ========================================

onAuthStateChanged(auth, (usuario) => {
    if (!usuario) {
        window.location.href = "../index.html";
        return;
    }

    const setorIdentificado = identificarSetor(usuario);

    if (!setorIdentificado) {
        usuarioAtual = null;

        campoMensagem.disabled = true;
        botaoEnviar.disabled = true;

        alert("Esta conta não está associada a um setor do iCOA.");
        return;
    }

    usuarioAtual = {
        uid: usuario.uid,
        email: usuario.email,
        setor: setorIdentificado
    };

    informacaoMensagem.textContent =
        "Conectado como " + usuarioAtual.setor;

    if (pararDeEscutar) {
        pararDeEscutar();
    }

    pararDeEscutar = onSnapshot(
        collection(db, "comunicacoes"),

        (resultado) => {
            todasMensagens = resultado.docs.map((documento) => ({
                id: documento.id,
                ...documento.data()
            }));

            atualizarBadges();
            mostrarMensagens();

            // Se o CCO estiver visualizando a conversa,
            // marcar as mensagens recebidas como lidas.
            marcarMensagensComoLidas();
        },

        (erro) => {
            console.error("Erro ao carregar mensagens:", erro);

            alert(
                "Não foi possível carregar as comunicações. " +
                "Confira as regras do Firestore."
            );
        }
    );

    if (areaSelecionada) {
        const eOutroSetor =
            areaSelecionada !== usuarioAtual.setor;

        campoMensagem.disabled = !eOutroSetor;
        botaoEnviar.disabled = !eOutroSetor;
    } else {
        campoMensagem.disabled = true;
        botaoEnviar.disabled = true;
    }
});

console.log("iCOA — Comunicações do CCO carregadas.");
