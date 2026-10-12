
import { db, auth } from "../firebase.js";

import {
    collection,
    onSnapshot
} from "firebase/firestore";

import { onAuthStateChanged } from "firebase/auth";

// ========================================
// ELEMENTOS DA PÁGINA
// ========================================

const listaOcorrencias = document.getElementById("listaOcorrencias");
const semOcorrencias = document.getElementById("semOcorrencias");
const numeros = document.querySelectorAll(".card-resumo .numero");
const contadorComunicacoes = document.getElementById("contadorComunicacoes");

let pararDeEscutarOcorrencias = null;
let pararDeEscutarComunicacoes = null;

// ========================================
// PROTEGER TEXTOS EXIBIDOS NOS CARDS
// ========================================

function escaparHTML(valor = "") {
    return String(valor).replace(/[&<>"']/g, function (caractere) {
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

// ========================================
// CARREGAR OCORRÊNCIAS DO ATENDIMENTO
// ========================================

function mostrarOcorrencias(documentos) {
    if (!listaOcorrencias || !semOcorrencias) return;

    listaOcorrencias.querySelectorAll(".ocorrencia").forEach(function (card) {
        card.remove();
    });

    const todasOcorrencias = documentos.map(function (documento) {
        return {
            id: documento.id,
            ...documento.data()
        };
    });

    const ocorrenciasAtendimento = todasOcorrencias.filter(function (ocorrencia) {
        return (
            ocorrencia.setor === "Atendimento" ||
            (
                Array.isArray(ocorrencia.areas) &&
                ocorrencia.areas.includes("Atendimento")
            )
        ) && ocorrencia.status !== "Encerrada";
    });

    if (numeros[0]) {
        numeros[0].textContent = ocorrenciasAtendimento.length;
    }

    semOcorrencias.style.display =
        ocorrenciasAtendimento.length === 0 ? "block" : "none";

    ocorrenciasAtendimento.forEach(criarCard);
}

// ========================================
// CRIAR CARD DA OCORRÊNCIA
// ========================================

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
    card.classList.add("ocorrencia");

    card.innerHTML = `
        <div class="status-ocorrencia ${corStatus}"></div>

        <div class="informacoes-ocorrencia">
            <div class="linha-superior">
                <strong>${escaparHTML(ocorrencia.voo || "Voo não informado")}</strong>

                <span class="status texto-${corStatus}">
                    ${textoStatus}
                </span>
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

    listaOcorrencias.appendChild(card);

    card.querySelector(".botao-ver").addEventListener("click", function () {
        alert(
            "INFORMAÇÕES PARA ATENDIMENTO\n\n" +
            "Voo: " + (ocorrencia.voo || "Não informado") +
            "\nAeronave: " + (ocorrencia.aeronave || "Não informada") +
            "\nTipo: " + (ocorrencia.tipo || "Não informado") +
            "\nGravidade: " + (ocorrencia.gravidade || "Não informada") +
            "\nDescrição: " + (ocorrencia.descricao || "Sem descrição") +
            "\nSetor responsável: " + (ocorrencia.setor || "Não informado") +
            "\nÁreas afetadas: " + (ocorrencia.areas || []).join(", ") +
            "\nStatus: " + (ocorrencia.status || "Em andamento")
        );
    });
}

// ========================================
// CONTADOR DE COMUNICAÇÕES NÃO LIDAS
// ========================================

function ouvirContadorComunicacoes() {
    pararDeEscutarComunicacoes = onSnapshot(
        collection(db, "comunicacoes"),
        function (snapshot) {
            const quantidade = snapshot.docs.filter(function (documento) {
                const mensagem = documento.data();

                return (
                    mensagem.destinatario === "Atendimento" &&
                    mensagem.lida !== true
                );
            }).length;

            if (contadorComunicacoes) {
                contadorComunicacoes.textContent = quantidade;
            }

            // O terceiro card é o de comunicações.
            if (numeros[2] && !contadorComunicacoes) {
                numeros[2].textContent = quantidade;
            }
        },
        function (erro) {
            console.error("Erro ao carregar contador de comunicações:", erro);
        }
    );
}

// ========================================
// LOGIN E ATUALIZAÇÕES EM TEMPO REAL
// ========================================

onAuthStateChanged(auth, function (usuario) {
    if (!usuario) {
        window.location.href = "../index.html";
        return;
    }

    if (pararDeEscutarOcorrencias) {
        pararDeEscutarOcorrencias();
    }

    if (pararDeEscutarComunicacoes) {
        pararDeEscutarComunicacoes();
    }

    pararDeEscutarOcorrencias = onSnapshot(
        collection(db, "ocorrencias"),
        function (resultado) {
            mostrarOcorrencias(resultado.docs);
        },
        function (erro) {
            console.error("Erro ao carregar ocorrências:", erro);

            if (semOcorrencias) {
                semOcorrencias.style.display = "block";

                const titulo = semOcorrencias.querySelector("h4");
                const descricao = semOcorrencias.querySelector("p");

                if (titulo) {
                    titulo.textContent = "Não foi possível carregar as atualizações";
                }

                if (descricao) {
                    descricao.textContent =
                        "Verifique a conexão e as regras do Firestore.";
                }
            }
        }
    );

    ouvirContadorComunicacoes();
});

console.log("iCOA — Painel do Atendimento carregado.");
