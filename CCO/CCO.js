
import { db, auth } from "../firebase.js";

import {
    collection,
    doc,
    onSnapshot,
    updateDoc
} from "firebase/firestore";

import { onAuthStateChanged } from "firebase/auth";

const listaOcorrencias = document.getElementById("listaOcorrencias");
const semOcorrencias = document.getElementById("semOcorrencias");
const contadorMensagens = document.getElementById("contadorMensagensNaoLidas");

const numerosResumo = document.querySelectorAll(".card-resumo .numero");

let pararDeEscutarOcorrencias = null;
let pararDeEscutarMensagens = null;

// PROTEGER OS TEXTOS EXIBIDOS NOS CARDS
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

// MOSTRAR AS OCORRÊNCIAS
function mostrarOcorrencias(documentos) {
    listaOcorrencias.innerHTML = "";

    const todas = documentos.map(function (documento) {
        return {
            id: documento.id,
            ...documento.data()
        };
    });

    // EXIBIR SOMENTE AS DIRECIONADAS AO CCO
    const ocorrenciasCCO = todas.filter(function (ocorrencia) {
        return ocorrencia.setor === "CCO" ||
            (ocorrencia.areas || []).includes("CCO");
    });

    const ativas = ocorrenciasCCO.filter(function (ocorrencia) {
        return ocorrencia.status !== "Encerrada";
    });

    const encerradas = ocorrenciasCCO.filter(function (ocorrencia) {
        return ocorrencia.status === "Encerrada";
    });

    // PRIMEIRO CARTÃO: OCORRÊNCIAS ATIVAS
    if (numerosResumo[0]) {
        numerosResumo[0].textContent = ativas.length;
    }

    // TERCEIRO CARTÃO: OCORRÊNCIAS NO HISTÓRICO
    if (numerosResumo[2]) {
        numerosResumo[2].textContent = encerradas.length;
    }

    semOcorrencias.style.display =
        ativas.length === 0 ? "block" : "none";

    ativas.forEach(criarCard);
}

// CRIAR CADA CARD DE OCORRÊNCIA
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
                <span>Áreas: ${escaparHTML((ocorrencia.areas || []).join(", "))}</span>
            </div>
        </div>

        <div class="acoes-ocorrencia">
            <button class="botao-encerrar" type="button">Encerrar</button>
            <button class="botao-ver" type="button">Ver detalhes</button>
        </div>
    `;

    listaOcorrencias.appendChild(card);

    // ENCERRAR NO FIRESTORE
    card.querySelector(".botao-encerrar").addEventListener("click", async function () {
        if (!confirm("Deseja encerrar esta ocorrência?")) return;

        try {
            await updateDoc(doc(db, "ocorrencias", ocorrencia.id), {
                status: "Encerrada"
            });

            alert("Ocorrência encerrada com sucesso!");
        } catch (erro) {
            console.error("Erro ao encerrar:", erro);
            alert("Não foi possível encerrar. Verifique as regras do Firestore.");
        }
    });

    // VER DETALHES
    card.querySelector(".botao-ver").addEventListener("click", function () {
        alert(
            "DETALHES DA OCORRÊNCIA\n\n" +
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

// CONTAR MENSAGENS AINDA NÃO LIDAS PELO CCO
function atualizarContadorMensagens(documentos) {
    const naoLidas = documentos.filter(function (documento) {
        const mensagem = documento.data();

        return mensagem.destinatario === "CCO"
            && mensagem.lida !== true;
    });

    if (contadorMensagens) {
        contadorMensagens.textContent = naoLidas.length;
    }
}

// CONECTAR AO FIREBASE E ATUALIZAR EM TEMPO REAL
onAuthStateChanged(auth, function (usuario) {
    if (!usuario) {
        if (pararDeEscutarOcorrencias) {
            pararDeEscutarOcorrencias();
            pararDeEscutarOcorrencias = null;
        }

        if (pararDeEscutarMensagens) {
            pararDeEscutarMensagens();
            pararDeEscutarMensagens = null;
        }

        window.location.href = "../index.html";
        return;
    }

    if (pararDeEscutarOcorrencias) {
        pararDeEscutarOcorrencias();
    }

    if (pararDeEscutarMensagens) {
        pararDeEscutarMensagens();
    }

    // ESCUTAR OCORRÊNCIAS
    pararDeEscutarOcorrencias = onSnapshot(
        collection(db, "ocorrencias"),
        function (resultado) {
            mostrarOcorrencias(resultado.docs);
        },
        function (erro) {
            console.error("Erro ao carregar ocorrências:", erro);
            alert("Erro ao carregar ocorrências. Confira as regras do Firestore.");
        }
    );

    // ESCUTAR MENSAGENS EM TEMPO REAL
    pararDeEscutarMensagens = onSnapshot(
        collection(db, "comunicacoes"),
        function (resultado) {
            atualizarContadorMensagens(resultado.docs);
        },
        function (erro) {
            console.error("Erro ao carregar mensagens:", erro);
        }
    );
});
