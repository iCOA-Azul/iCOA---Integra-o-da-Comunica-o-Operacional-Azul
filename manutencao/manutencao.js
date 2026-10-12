
import { db, auth } from "../firebase.js";

import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    onSnapshot,
    serverTimestamp
} from "firebase/firestore";

import { onAuthStateChanged } from "firebase/auth";

// ======================================
// ELEMENTOS DO HTML
// ======================================

const botaoNovaOcorrencia = document.getElementById("novaOcorrencia");
const formularioOcorrencia = document.getElementById("formularioOcorrencia");
const formOcorrencia = document.getElementById("formOcorrencia");
const cancelarOcorrencia = document.getElementById("cancelarOcorrencia");

const listaOcorrencias = document.getElementById("listaOcorrencias");
const semOcorrencias = document.getElementById("semOcorrencias");
const contadorOcorrencias = document.getElementById("contadorOcorrencias");

const listaAvisos = document.getElementById("listaAvisos");
const semAvisos = document.getElementById("semAvisos");
const contadorAvisos = document.getElementById("contadorAvisos");
const contadorComunicacoes = document.getElementById("contadorComunicacoes");

const SETOR = "Manutenção";

let pararDeEscutar = null;
let pararComunicacoes = null;

// ======================================
// FUNÇÕES AUXILIARES
// ======================================

function escaparHTML(valor = "") {
    return String(valor).replace(/[&<>"']/g, (caractere) => {
        const caracteres = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return caracteres[caractere];
    });
}

function formatarHorario(timestamp) {
    if (!timestamp?.toDate) {
        return "Horário não disponível";
    }

    return timestamp.toDate().toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
    });
}

// ======================================
// MOSTRAR OCORRÊNCIAS
// ======================================

function mostrarOcorrencias(documentos) {
    if (!listaOcorrencias || !semOcorrencias || !contadorOcorrencias) {
        return;
    }

    listaOcorrencias.querySelectorAll(".ocorrencia").forEach((card) => {
        card.remove();
    });

    const ocorrencias = documentos
        .map((documento) => ({
            id: documento.id,
            ...documento.data()
        }))
        .filter((dados) => dados.status !== "Encerrada")
        .filter((dados) =>
            dados.setor === SETOR ||
            (dados.areas || []).includes(SETOR)
        );

    contadorOcorrencias.textContent = ocorrencias.length;

    semOcorrencias.style.display =
        ocorrencias.length === 0 ? "block" : "none";

    ocorrencias.forEach(criarCardOcorrencia);
}

// ======================================
// CRIAR CARTÃO DE OCORRÊNCIA
// ======================================

function criarCardOcorrencia(dados) {
    let corStatus = "amarelo";
    let textoStatus = "MÉDIA";

    if (dados.gravidade === "Alta") {
        corStatus = "vermelho";
        textoStatus = "ALTA";
    } else if (dados.gravidade === "Baixa") {
        corStatus = "verde";
        textoStatus = "BAIXA";
    }

    const card = document.createElement("div");
    card.classList.add("ocorrencia");

    card.innerHTML = `
        <div class="status-ocorrencia ${corStatus}"></div>

        <div class="informacoes-ocorrencia">
            <div class="linha-superior">
                <strong>${escaparHTML(dados.voo || "Voo não informado")}</strong>

                <span class="status texto-${corStatus}">
                    ${textoStatus}
                </span>
            </div>

            <h4>${escaparHTML(dados.tipo || "Não informado")}</h4>

            <p>${escaparHTML(dados.descricao || "Sem descrição")}</p>

            <div class="detalhes">
                <span>✈ ${escaparHTML(dados.aeronave || "Não informada")}</span>
                <span>🔧 ${escaparHTML(dados.setor || "Não informado")}</span>
                <span>● ${escaparHTML(dados.status || "Em andamento")}</span>
                <span>Áreas: ${escaparHTML(
                    (dados.areas || []).join(", ") || "Não informadas"
                )}</span>
            </div>
        </div>

        <div class="acoes-ocorrencia">
            <button class="botao-encerrar" type="button">
                Encerrar
            </button>

            <button class="botao-excluir" type="button">
                Excluir
            </button>
        </div>
    `;

    listaOcorrencias.appendChild(card);

    card.querySelector(".botao-encerrar").addEventListener("click", async () => {
        if (!confirm("Deseja encerrar esta ocorrência?")) {
            return;
        }

        try {
            await updateDoc(doc(db, "ocorrencias", dados.id), {
                status: "Encerrada"
            });

            alert("Ocorrência encerrada!");
        } catch (erro) {
            console.error("Erro ao encerrar ocorrência:", erro);
            alert("Não foi possível encerrar. Verifique as regras do Firestore.");
        }
    });

    card.querySelector(".botao-excluir").addEventListener("click", async () => {
        if (!confirm("Deseja realmente excluir esta ocorrência?")) {
            return;
        }

        try {
            await deleteDoc(doc(db, "ocorrencias", dados.id));
            alert("Ocorrência excluída!");
        } catch (erro) {
            console.error("Erro ao excluir ocorrência:", erro);
            alert("Não foi possível excluir. Verifique as regras do Firestore.");
        }
    });
}

// ======================================
// FORMULÁRIO DE OCORRÊNCIAS
// ======================================

if (botaoNovaOcorrencia && formularioOcorrencia) {
    botaoNovaOcorrencia.addEventListener("click", () => {
        formularioOcorrencia.style.display = "block";
    });
}

if (cancelarOcorrencia && formularioOcorrencia && formOcorrencia) {
    cancelarOcorrencia.addEventListener("click", () => {
        formularioOcorrencia.style.display = "none";
        formOcorrencia.reset();
    });
}

if (formOcorrencia) {
    formOcorrencia.addEventListener("submit", async (event) => {
        event.preventDefault();

        const usuario = auth.currentUser;

        if (!usuario) {
            alert("Sua sessão expirou. Entre novamente.");
            return;
        }

        const voo = document.getElementById("voo").value.trim();
        const aeronave = document.getElementById("aeronave").value.trim();
        const tipo = document.getElementById("tipo").value;
        const gravidade = document.getElementById("gravidade").value;
        const descricao = document.getElementById("descricao").value.trim();

        const areasAfetadas = [];

        document.querySelectorAll(".checkbox input:checked").forEach((checkbox) => {
            areasAfetadas.push(checkbox.value);
        });

        if (areasAfetadas.length === 0) {
            alert("Selecione pelo menos uma área afetada.");
            return;
        }

        const dadosOcorrencia = {
            voo,
            aeronave,
            tipo,
            gravidade,
            descricao,
            areas: areasAfetadas,
            setor: SETOR,
            status: "Em andamento",
            criadoPorUid: usuario.uid,
            criadoEm: serverTimestamp()
        };

        const botaoEnviar = formOcorrencia.querySelector('button[type="submit"]');

        if (botaoEnviar) {
            botaoEnviar.disabled = true;
        }

        try {
            await addDoc(collection(db, "ocorrencias"), dadosOcorrencia);

            formOcorrencia.reset();
            formularioOcorrencia.style.display = "none";

            alert("Ocorrência registrada e enviada ao Firestore!");
        } catch (erro) {
            console.error("Erro ao registrar ocorrência:", erro);
            alert("Não foi possível registrar. Verifique sua conexão e as regras do Firestore.");
        } finally {
            if (botaoEnviar) {
                botaoEnviar.disabled = false;
            }
        }
    });
}

// ======================================
// MOSTRAR AVISOS RECEBIDOS
// ======================================

function mostrarAvisos(mensagens) {
    if (!listaAvisos || !semAvisos) {
        return;
    }

    listaAvisos.querySelectorAll(".aviso-card").forEach((aviso) => {
        aviso.remove();
    });

    const recebidas = mensagens
        .filter((mensagem) => mensagem.destinatario === SETOR)
        .sort((a, b) => {
            const dataA = a.criadoEm?.toMillis?.() ?? 0;
            const dataB = b.criadoEm?.toMillis?.() ?? 0;

            return dataB - dataA;
        });

    const naoLidas = recebidas.filter(
        (mensagem) => mensagem.lida !== true
    );

    if (contadorAvisos) {
        contadorAvisos.textContent = naoLidas.length;
    }

    semAvisos.style.display =
        recebidas.length === 0 ? "block" : "none";

    recebidas.forEach((mensagem) => {
        const aviso = document.createElement("article");
        aviso.className = "aviso-card";

        aviso.innerHTML = `
            <div class="aviso-cabecalho">
                <strong>${escaparHTML(mensagem.remetente || "CCO")}</strong>
                <small>${escaparHTML(formatarHorario(mensagem.criadoEm))}</small>
            </div>

            <p>${escaparHTML(mensagem.texto || "")}</p>

            <small>${mensagem.lida === true ? "Lido" : "Não lido"}</small>
        `;

        listaAvisos.appendChild(aviso);
    });
}

// ======================================
// COMUNICAÇÕES EM TEMPO REAL
// ======================================

function acompanharComunicacoes() {
    if (pararComunicacoes) {
        pararComunicacoes();
        pararComunicacoes = null;
    }

    pararComunicacoes = onSnapshot(
        collection(db, "comunicacoes"),
        (snapshot) => {
            const mensagens = snapshot.docs.map((documento) => ({
                id: documento.id,
                ...documento.data()
            }));

            // Contar somente mensagens destinadas à Manutenção
            // que ainda não estão marcadas como lidas.
            const comunicacoesNaoLidas = mensagens.filter((mensagem) =>
                mensagem.destinatario === SETOR &&
                mensagem.lida !== true
            );

            if (contadorComunicacoes) {
                contadorComunicacoes.textContent =
                    comunicacoesNaoLidas.length;
            }

            console.log("Total de documentos:", snapshot.size);
            console.log(
                "Comunicações não lidas da Manutenção:",
                comunicacoesNaoLidas
            );

            mostrarAvisos(mensagens);
        },
        (erro) => {
            console.error(
                "Erro ao carregar comunicações:",
                erro.code,
                erro.message
            );
        }
    );
}

// ======================================
// AUTENTICAÇÃO E ATUALIZAÇÃO
// ======================================

onAuthStateChanged(auth, (usuario) => {
    if (!usuario) {
        if (pararDeEscutar) {
            pararDeEscutar();
            pararDeEscutar = null;
        }

        if (pararComunicacoes) {
            pararComunicacoes();
            pararComunicacoes = null;
        }

        window.location.href = "../index.html";
        return;
    }

    if (pararDeEscutar) {
        pararDeEscutar();
        pararDeEscutar = null;
    }

    pararDeEscutar = onSnapshot(
        collection(db, "ocorrencias"),
        (resultado) => {
            mostrarOcorrencias(resultado.docs);
        },
        (erro) => {
            console.error("Erro ao carregar ocorrências:", erro);
            alert("Não foi possível carregar as ocorrências. Confira as regras do Firestore.");
        }
    );

    acompanharComunicacoes();
});

console.log("iCOA — Manutenção carregado.");
