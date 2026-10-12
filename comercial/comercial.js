
import { db, auth } from "../firebase.js";

import {
    collection,
    onSnapshot
} from "firebase/firestore";

import { onAuthStateChanged } from "firebase/auth";

// ======================================
// ELEMENTOS DA PÁGINA
// ======================================

const listaOcorrencias = document.getElementById("listaOcorrencias");
const semOcorrencias = document.getElementById("semOcorrencias");
const botaoNovoImpacto = document.getElementById("novoImpacto");

const contadorImpactos = document.getElementById("contadorImpactos");
const contadorAvisos = document.getElementById("contadorAvisos");
const contadorComunicacoes = document.getElementById("contadorComunicacoes");

const listaAvisos = document.getElementById("listaAvisos");
const semAvisos = document.getElementById("semAvisos");

let pararOcorrencias = null;
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
// BOTÃO NOVO IMPACTO
// ======================================

if (botaoNovoImpacto) {
    botaoNovoImpacto.addEventListener("click", () => {
        alert(
            "Os impactos comerciais são identificados a partir das ocorrências operacionais direcionadas ao Comercial.\n\n" +
            "Quando um setor registrar uma ocorrência e selecionar o Comercial, ela aparecerá automaticamente nesta página."
        );
    });
}

// ======================================
// OCORRÊNCIAS E IMPACTOS COMERCIAIS
// ======================================

function criarCard(ocorrencia) {
    let corStatus = "amarelo";
    let textoStatus = "MÉDIA";

    if (ocorrencia.gravidade === "Alta") {
        corStatus = "vermelho";
        textoStatus = "ALTA";
    } else if (ocorrencia.gravidade === "Baixa") {
        corStatus = "verde";
        textoStatus = "BAIXA";
    }

    const card = document.createElement("div");
    card.className = "ocorrencia";

    card.innerHTML = `
        <div class="status-ocorrencia ${corStatus}"></div>

        <div class="informacoes-ocorrencia">
            <div class="linha-superior">
                <strong>${escaparHTML(ocorrencia.voo || "Voo não informado")}</strong>
                <span class="status texto-${corStatus}">${textoStatus}</span>
            </div>

            <h4>${escaparHTML(ocorrencia.tipo || "Ocorrência operacional")}</h4>

            <p>${escaparHTML(ocorrencia.descricao || "Sem descrição")}</p>

            <div class="detalhes">
                <span>✈ ${escaparHTML(ocorrencia.aeronave || "Não informada")}</span>
                <span>🔧 ${escaparHTML(ocorrencia.setor || "Não informado")}</span>
                <span>● ${escaparHTML(ocorrencia.status || "Em andamento")}</span>
            </div>
        </div>

        <button class="botao-ver" type="button">Ver detalhes</button>
    `;

    card.querySelector(".botao-ver").addEventListener("click", () => {
        const areas = Array.isArray(ocorrencia.areas)
            ? ocorrencia.areas.join(", ")
            : "Não informadas";

        alert(
            "DETALHES DO IMPACTO COMERCIAL\n\n" +
            "Voo: " + (ocorrencia.voo || "Não informado") +
            "\nAeronave: " + (ocorrencia.aeronave || "Não informada") +
            "\nTipo: " + (ocorrencia.tipo || "Não informado") +
            "\nGravidade: " + (ocorrencia.gravidade || "Não informada") +
            "\nDescrição: " + (ocorrencia.descricao || "Sem descrição") +
            "\nSetor responsável: " + (ocorrencia.setor || "Não informado") +
            "\nÁreas afetadas: " + areas +
            "\nStatus: " + (ocorrencia.status || "Em andamento")
        );
    });

    listaOcorrencias.appendChild(card);
}

function mostrarOcorrencias(documentos) {
    if (!listaOcorrencias || !semOcorrencias) return;

    listaOcorrencias.querySelectorAll(".ocorrencia").forEach((card) => {
        card.remove();
    });

    const ocorrenciasComercial = documentos
        .map((documento) => ({
            id: documento.id,
            ...documento.data()
        }))
        .filter((ocorrencia) => {
            const direcionadaAoComercial =
                ocorrencia.setor === "Comercial" ||
                (
                    Array.isArray(ocorrencia.areas) &&
                    ocorrencia.areas.includes("Comercial")
                );

            return direcionadaAoComercial &&
                ocorrencia.status !== "Encerrada";
        });

    if (contadorImpactos) {
        contadorImpactos.textContent = ocorrenciasComercial.length;
    }

    semOcorrencias.style.display =
        ocorrenciasComercial.length === 0 ? "block" : "none";

    ocorrenciasComercial.forEach(criarCard);
}

// ======================================
// AVISOS
// ======================================

function mostrarAvisos(mensagens) {
    if (!listaAvisos || !semAvisos) return;

    listaAvisos.querySelectorAll(".aviso-card").forEach((aviso) => {
        aviso.remove();
    });

    const recebidas = mensagens
        .filter((mensagem) => mensagem.destinatario === "Comercial")
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
                <strong>${escaparHTML(mensagem.remetente || "Setor")}</strong>
                <small>${escaparHTML(formatarHorario(mensagem.criadoEm))}</small>
            </div>

            <p>${escaparHTML(mensagem.texto || "")}</p>

            <small>${mensagem.lida === true ? "Lido" : "Não lido"}</small>
        `;

        listaAvisos.appendChild(aviso);
    });
}

// ======================================
// CONTADOR DE COMUNICAÇÕES
// ======================================

function acompanharComunicacoes() {
    pararComunicacoes = onSnapshot(
        collection(db, "comunicacoes"),

        (snapshot) => {
            const mensagens = snapshot.docs.map((documento) => ({
                id: documento.id,
                ...documento.data()
            }));

            mostrarAvisos(mensagens);

            // Contar somente mensagens recebidas pelo Comercial
            // que ainda não possuem confirmação de leitura.
            const comunicacoesNaoLidas = mensagens.filter((mensagem) => {
                return (
                    mensagem.destinatario === "Comercial" &&
                    mensagem.lida !== true
                );
            });

            if (contadorComunicacoes) {
                contadorComunicacoes.textContent =
                    String(comunicacoesNaoLidas.length);
            }

            // Diagnóstico no Console: mostra apenas mensagens
            // recebidas pelo Comercial que continuam não lidas.
            console.log(
                "Mensagens não lidas do Comercial:",
                comunicacoesNaoLidas.map((mensagem) => ({
                    id: mensagem.id,
                    remetente: mensagem.remetente,
                    destinatario: mensagem.destinatario,
                    lida: mensagem.lida
                }))
            );
        },

        (erro) => {
            console.error("Erro ao carregar comunicações:", erro);
        }
    );
}

// ======================================
// LOGIN E ATUALIZAÇÃO EM TEMPO REAL
// ======================================

onAuthStateChanged(auth, (usuario) => {
    if (!usuario) {
        if (pararOcorrencias) {
            pararOcorrencias();
            pararOcorrencias = null;
        }

        if (pararComunicacoes) {
            pararComunicacoes();
            pararComunicacoes = null;
        }

        window.location.href = "../index.html";
        return;
    }

    if (pararOcorrencias) pararOcorrencias();
    if (pararComunicacoes) pararComunicacoes();

    pararOcorrencias = onSnapshot(
        collection(db, "ocorrencias"),

        (resultado) => {
            mostrarOcorrencias(resultado.docs);
        },

        (erro) => {
            console.error("Erro ao carregar impactos:", erro);

            if (semOcorrencias) {
                semOcorrencias.style.display = "block";

                const titulo = semOcorrencias.querySelector("h4");
                const descricao = semOcorrencias.querySelector("p");

                if (titulo) {
                    titulo.textContent =
                        "Não foi possível carregar os impactos";
                }

                if (descricao) {
                    descricao.textContent =
                        "Verifique a conexão e as regras do Firestore.";
                }
            }
        }
    );

    acompanharComunicacoes();
});

console.log("iCOA — Comercial carregado.");
