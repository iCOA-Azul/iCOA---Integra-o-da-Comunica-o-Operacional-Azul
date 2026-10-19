
import { db, auth } from "../firebase.js";

import {
    collection,
    onSnapshot,
    deleteDoc,
    doc
} from "firebase/firestore";

import { onAuthStateChanged } from "firebase/auth";

// ======================================
// ELEMENTOS DO HTML
// ======================================

const listaOcorrencias = document.getElementById("listaOcorrencias");
const semOcorrencias = document.getElementById("semOcorrencias");
const contadorOcorrencias = document.getElementById("contadorOcorrencias");
const contadorAlta = document.getElementById("contadorAlta");
const mensagemErro = document.getElementById("mensagemErro");

const pesquisa = document.getElementById("pesquisa");
const filtroStatus = document.getElementById("filtroStatus");
const filtroGravidade = document.getElementById("filtroGravidade");

let todasOcorrencias = [];
let pararOcorrencias = null;

// ======================================
// PROTEGER OS TEXTOS EXIBIDOS
// ======================================

function escaparHTML(valor = "") {
    return String(valor).replace(/[&<>"']/g, caractere => {
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

// ======================================
// FORMATAR DATA E HORÁRIO
// ======================================

function formatarHorario(timestamp) {
    if (!timestamp?.toDate) {
        return "Horário não disponível";
    }

    return timestamp.toDate().toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

// ======================================
// IDENTIFICAR OCORRÊNCIAS DO COMERCIAL
// ======================================

function relacionadaAoComercial(ocorrencia) {
    const areas = Array.isArray(ocorrencia.areas)
        ? ocorrencia.areas
        : [];

    return ocorrencia.setor === "Comercial" ||
        areas.includes("Comercial");
}

// ======================================
// PESQUISA E FILTROS
// ======================================

function aplicarFiltros() {
    const termo = pesquisa.value.trim().toLocaleLowerCase("pt-BR");
    const statusEscolhido = filtroStatus.value;
    const gravidadeEscolhida = filtroGravidade.value;

    const filtradas = todasOcorrencias.filter(ocorrencia => {
        const encerrada = ocorrencia.status === "Encerrada";

        const areas = Array.isArray(ocorrencia.areas)
            ? ocorrencia.areas
            : [];

        // Campos que podem ser pesquisados.
        const textoPesquisa = [
            ocorrencia.voo,
            ocorrencia.aeronave,
            ocorrencia.tipo,
            ocorrencia.descricao,
            ocorrencia.setor,
            ocorrencia.status,
            ocorrencia.gravidade,
            ...areas
        ]
            .filter(Boolean)
            .join(" ")
            .toLocaleLowerCase("pt-BR");

        const correspondePesquisa = textoPesquisa.includes(termo);

        const correspondeStatus =
            statusEscolhido === "Todas" ||
            (statusEscolhido === "Ativas" && !encerrada) ||
            (statusEscolhido === "Encerrada" && encerrada);

        const correspondeGravidade =
            gravidadeEscolhida === "Todas" ||
            ocorrencia.gravidade === gravidadeEscolhida;

        return correspondePesquisa &&
            correspondeStatus &&
            correspondeGravidade;
    });

    // Remover somente os cartões anteriores.
    listaOcorrencias
        .querySelectorAll(".ocorrencia")
        .forEach(card => card.remove());

    semOcorrencias.style.display =
        filtradas.length === 0 ? "block" : "none";

    if (filtradas.length === 0) {
        if (todasOcorrencias.length === 0) {
            semOcorrencias.querySelector("h4").textContent =
                "Nenhuma ocorrência encontrada";

            semOcorrencias.querySelector("p").textContent =
                "As ocorrências registradas pelo Comercial ou direcionadas a este setor aparecerão aqui.";
        } else {
            semOcorrencias.querySelector("h4").textContent =
                "Nenhuma ocorrência corresponde à pesquisa";

            semOcorrencias.querySelector("p").textContent =
                "Tente alterar o texto pesquisado ou os filtros selecionados.";
        }

        return;
    }

    filtradas.forEach(ocorrencia => {
        listaOcorrencias.appendChild(criarCard(ocorrencia));
    });
}

// Atualizar a lista ao digitar ou mudar os filtros.
pesquisa.addEventListener("input", aplicarFiltros);
filtroStatus.addEventListener("change", aplicarFiltros);
filtroGravidade.addEventListener("change", aplicarFiltros);

// ======================================
// CRIAR CARTÃO DA OCORRÊNCIA
// ======================================

function criarCard(ocorrencia) {
    let corStatus = "amarelo";
    let textoGravidade = "MÉDIA";

    if (ocorrencia.gravidade === "Alta") {
        corStatus = "vermelho";
        textoGravidade = "ALTA";
    } else if (ocorrencia.gravidade === "Baixa") {
        corStatus = "verde";
        textoGravidade = "BAIXA";
    }

    const areas = Array.isArray(ocorrencia.areas)
        ? ocorrencia.areas.join(", ")
        : "Não informadas";

    const card = document.createElement("article");
    card.className = "ocorrencia";

    card.innerHTML = `
        <div class="status-ocorrencia ${corStatus}"></div>

        <div class="informacoes-ocorrencia">

            <div class="linha-superior">
                <strong>${escaparHTML(
                    ocorrencia.voo || "Voo não informado"
                )}</strong>

                <span class="status texto-${corStatus}">
                    ${textoGravidade}
                </span>
            </div>

            <h4>${escaparHTML(
                ocorrencia.tipo || "Ocorrência comercial"
            )}</h4>

            <p>${escaparHTML(
                ocorrencia.descricao || "Sem descrição"
            )}</p>

            <div class="detalhes">
                <span>✈ Aeronave: ${escaparHTML(
                    ocorrencia.aeronave || "Não informada"
                )}</span>

                <span>Setor responsável: ${escaparHTML(
                    ocorrencia.setor || "Não informado"
                )}</span>

                <span>Status: ${escaparHTML(
                    ocorrencia.status || "Em andamento"
                )}</span>

                <span>Áreas envolvidas: ${escaparHTML(areas)}</span>

                <span>Registrada em: ${escaparHTML(
                    formatarHorario(ocorrencia.criadoEm)
                )}</span>
            </div>

            <div class="botoes-card">
                <button class="botao-ver" type="button">
                    Ver detalhes
                </button>
            </div>

        </div>
    `;

    // ======================================
    // VER DETALHES
    // ======================================

    card.querySelector(".botao-ver").addEventListener("click", () => {
        alert(
            "DETALHES DA OCORRÊNCIA\n\n" +
            "Voo: " + (ocorrencia.voo || "Não informado") +
            "\nAeronave: " + (ocorrencia.aeronave || "Não informada") +
            "\nTipo: " + (ocorrencia.tipo || "Não informado") +
            "\nGravidade: " + (ocorrencia.gravidade || "Não informada") +
            "\nDescrição: " + (ocorrencia.descricao || "Sem descrição") +
            "\nSetor responsável: " + (ocorrencia.setor || "Não informado") +
            "\nÁreas envolvidas: " + areas +
            "\nStatus: " + (ocorrencia.status || "Em andamento") +
            "\nCriada em: " + formatarHorario(ocorrencia.criadoEm)
        );
    });

    // ======================================
    // EXCLUIR SOMENTE SE FOR O CRIADOR
    // ======================================

    const usuarioAtual = auth.currentUser;

    if (
        usuarioAtual &&
        ocorrencia.criadoPorUid === usuarioAtual.uid
    ) {
        const botaoExcluir = document.createElement("button");

        botaoExcluir.type = "button";
        botaoExcluir.className = "botao-ver botao-excluir";
        botaoExcluir.textContent = "Excluir";

        botaoExcluir.addEventListener("click", async () => {
            const confirmou = confirm(
                "Tem certeza de que deseja excluir esta ocorrência?"
            );

            if (!confirmou) {
                return;
            }

            botaoExcluir.disabled = true;
            botaoExcluir.textContent = "Excluindo...";

            try {
                await deleteDoc(
                    doc(db, "ocorrencias", ocorrencia.id)
                );
                // A lista será atualizada pelo Firebase.
            } catch (erro) {
                console.error("Erro ao excluir ocorrência:", erro);

                alert(
                    "Não foi possível excluir a ocorrência. " +
                    "Verifique as permissões do Firebase."
                );

                botaoExcluir.disabled = false;
                botaoExcluir.textContent = "Excluir";
            }
        });

        card.querySelector(".botoes-card").appendChild(botaoExcluir);
    }

    return card;
}

// ======================================
// CONTADORES
// ======================================

function atualizarContadores() {
    const ativas = todasOcorrencias.filter(
        ocorrencia => ocorrencia.status !== "Encerrada"
    );

    contadorOcorrencias.textContent = ativas.length;

    contadorAlta.textContent = ativas.filter(
        ocorrencia => ocorrencia.gravidade === "Alta"
    ).length;
}

// ======================================
// LOGIN E FIREBASE EM TEMPO REAL
// ======================================

onAuthStateChanged(auth, usuario => {
    if (pararOcorrencias) {
        pararOcorrencias();
        pararOcorrencias = null;
    }

    if (!usuario) {
        window.location.href = "../index.html";
        return;
    }

    mensagemErro.hidden = true;
    semOcorrencias.style.display = "block";

    semOcorrencias.querySelector("h4").textContent =
        "Carregando ocorrências...";

    semOcorrencias.querySelector("p").textContent =
        "As ocorrências do Comercial aparecerão nesta área.";

    pararOcorrencias = onSnapshot(
        collection(db, "ocorrencias"),

        resultado => {
            mensagemErro.hidden = true;

            // Preserva somente ocorrências relacionadas ao Comercial,
            // incluindo as encerradas para permitir a consulta.
            todasOcorrencias = resultado.docs
                .map(documento => ({
                    ...documento.data(),
                    id: documento.id
                }))
                .filter(relacionadaAoComercial)
                .sort((a, b) => {
                    const dataA = a.criadoEm?.toMillis?.() ?? 0;
                    const dataB = b.criadoEm?.toMillis?.() ?? 0;

                    return dataB - dataA;
                });

            atualizarContadores();
            aplicarFiltros();
        },

        erro => {
            console.error(
                "Erro ao carregar ocorrências:",
                erro
            );

            mensagemErro.hidden = false;
            semOcorrencias.style.display = "block";

            semOcorrencias.querySelector("h4").textContent =
                "Não foi possível carregar as ocorrências";

            semOcorrencias.querySelector("p").textContent =
                "Verifique a conexão e as permissões do Firebase.";
        }
    );
});

console.log("iCOA — Ocorrências do Comercial carregado.");
