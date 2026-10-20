
import { db, auth } from "../firebase.js";

import {
    collection,
    onSnapshot,
    addDoc,
    serverTimestamp,
    updateDoc,
    deleteDoc,
    doc
} from "firebase/firestore";

import { onAuthStateChanged } from "firebase/auth";

// ========================================
// ELEMENTOS DA PÁGINA
// ========================================

const listaOcorrencias = document.getElementById("listaOcorrencias");
const semOcorrencias = document.getElementById("semOcorrencias");
const numeros = document.querySelectorAll(".card-resumo .numero");
const contadorComunicacoes = document.getElementById("contadorComunicacoes");

const botaoAbrirFormulario = document.getElementById("abrirFormularioOcorrencia");
const formularioOcorrencia = document.getElementById("formularioOcorrencia");
const formOcorrencia = document.getElementById("formOcorrenciaAtendimento");
const botaoCancelar = document.getElementById("cancelarFormularioOcorrencia");

const campoVoo = document.getElementById("vooOcorrencia");
const campoAeronave = document.getElementById("aeronaveOcorrencia");
const campoTipo = document.getElementById("tipoOcorrencia");
const campoGravidade = document.getElementById("gravidadeOcorrencia");
const campoDescricao = document.getElementById("descricaoOcorrencia");

let pararDeEscutarOcorrencias = null;
let pararDeEscutarComunicacoes = null;

// ========================================
// ABRIR E FECHAR O FORMULÁRIO
// ========================================

if (botaoAbrirFormulario && formularioOcorrencia) {
    botaoAbrirFormulario.addEventListener("click", function () {
        formularioOcorrencia.hidden = !formularioOcorrencia.hidden;
    });
}

if (botaoCancelar && formularioOcorrencia && formOcorrencia) {
    botaoCancelar.addEventListener("click", function () {
        formOcorrencia.reset();
        formularioOcorrencia.hidden = true;
    });
}

// ========================================
// REGISTRAR OCORRÊNCIA NO FIREBASE
// ========================================

if (formOcorrencia) {
    formOcorrencia.addEventListener("submit", async function (evento) {
        evento.preventDefault();

        const usuario = auth.currentUser;

        if (!usuario) {
            alert("Sua sessão expirou. Entre novamente no sistema.");
            return;
        }

        const voo = campoVoo.value.trim();
        const aeronave = campoAeronave.value.trim();
        const tipo = campoTipo.value;
        const gravidade = campoGravidade.value;
        const descricao = campoDescricao.value.trim();

        if (!voo || !aeronave ||  !tipo || !gravidade || !descricao) {
            alert("Preencha todos os campos antes de registrar.");
            return;
        }

        const botaoEnviar = formOcorrencia.querySelector(
            'button[type="submit"]'
        );

        if (botaoEnviar) {
            botaoEnviar.disabled = true;
            botaoEnviar.textContent = "Registrando...";
        }

        try {
            await addDoc(collection(db, "ocorrencias"), {
                voo: voo,
                aeronave: aeronave,
                tipo: tipo,
                gravidade: gravidade,
                descricao: descricao,
                setor: "Atendimento",
                areas: ["Atendimento", "CCO"],
                status: "Em andamento",
                criadoPorUid: usuario.uid,
                criadoEm: serverTimestamp()
            });

            formOcorrencia.reset();
            formularioOcorrencia.hidden = true;

            alert("Ocorrência registrada com sucesso!");

        } catch (erro) {
            console.error("Erro ao registrar ocorrência:", erro);

            alert(
                "Não foi possível registrar a ocorrência. " +
                "Verifique sua conexão e as permissões do Firebase."
            );

        } finally {
            if (botaoEnviar) {
                botaoEnviar.disabled = false;
                botaoEnviar.textContent = "Registrar ocorrência";
            }
        }
    });
}

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

    const ocorrenciasAtendimento = todasOcorrencias.filter(
        function (ocorrencia) {
            return (
                ocorrencia.setor === "Atendimento" ||
                (
                    Array.isArray(ocorrencia.areas) &&
                    ocorrencia.areas.includes("Atendimento")
                )
            ) && ocorrencia.status !== "Encerrada";
        }
    );

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

        <div class="acoes-ocorrencia">
            <button class="botao-ver" type="button">Ver detalhes</button>
        </div>
    `;

    listaOcorrencias.appendChild(card);

    // ========================================
    // VER DETALHES
    // ========================================

    card.querySelector(".botao-ver").addEventListener("click", function () {
        alert(
            "INFORMAÇÕES PARA ATENDIMENTO\n\n" +
            "Voo: " + (ocorrencia.voo || "Não informado") +
            "\nAeronave: " + (ocorrencia.aeronave || "Não informada") +
            "\nTipo: " + (ocorrencia.tipo || "Não informado") +
            "\nGravidade: " + (ocorrencia.gravidade || "Não informada") +
            "\nDescrição: " + (ocorrencia.descricao || "Sem descrição") +
            "\nSetor responsável: " + (ocorrencia.setor || "Não informado") +
            "\nÁreas envolvidas: " +
            (Array.isArray(ocorrencia.areas)
                ? ocorrencia.areas.join(", ")
                : "Não informadas") +
            "\nStatus: " + (ocorrencia.status || "Em andamento")
        );
    });

    // ========================================
    // ENCERRAR E EXCLUIR A PRÓPRIA OCORRÊNCIA
    // ========================================

    const usuarioAtual = auth.currentUser;

    // Os botões só aparecem para quem criou a ocorrência.
    if (
        usuarioAtual &&
        ocorrencia.criadoPorUid === usuarioAtual.uid
    ) {
        const areaBotoes = card.querySelector(".acoes-ocorrencia");

        // BOTÃO ENCERRAR
        const botaoEncerrar = document.createElement("button");

        botaoEncerrar.type = "button";
        botaoEncerrar.className = "botao-encerrar";
        botaoEncerrar.textContent = "Encerrar ocorrência";

        botaoEncerrar.addEventListener("click", async function () {
            const confirmou = confirm(
                "Deseja realmente encerrar esta ocorrência?"
            );

            if (!confirmou) return;

            botaoEncerrar.disabled = true;
            botaoEncerrar.textContent = "Encerrando...";

            try {
                await updateDoc(
                    doc(db, "ocorrencias", ocorrencia.id),
                    {
                        status: "Encerrada"
                    }
                );

                alert("Ocorrência encerrada com sucesso!");

                // A atualização em tempo real retirará o cartão
                // da lista de ocorrências ativas.

            } catch (erro) {
                console.error("Erro ao encerrar ocorrência:", erro);

                alert(
                    "Não foi possível encerrar a ocorrência.\n\n" +
                    "Verifique as permissões do Firebase."
                );

                botaoEncerrar.disabled = false;
                botaoEncerrar.textContent = "Encerrar ocorrência";
            }
        });

        areaBotoes.appendChild(botaoEncerrar);

        // BOTÃO EXCLUIR
        const botaoExcluir = document.createElement("button");

        botaoExcluir.type = "button";
        botaoExcluir.className = "botao-excluir";
        botaoExcluir.textContent = "Excluir";

        botaoExcluir.addEventListener("click", async function () {
            const confirmou = confirm(
                "Tem certeza de que deseja excluir esta ocorrência? " +
                "Esta ação não poderá ser desfeita."
            );

            if (!confirmou) return;

            botaoExcluir.disabled = true;
            botaoExcluir.textContent = "Excluindo...";

            try {
                await deleteDoc(
                    doc(db, "ocorrencias", ocorrencia.id)
                );

                alert("Ocorrência excluída com sucesso!");

                // A atualização em tempo real retirará o cartão
                // após a exclusão do documento.

            } catch (erro) {
                console.error("Erro ao excluir ocorrência:", erro);

                alert(
                    "Não foi possível excluir a ocorrência.\n\n" +
                    "Verifique as permissões do Firebase."
                );

                botaoExcluir.disabled = false;
                botaoExcluir.textContent = "Excluir";
            }
        });

        areaBotoes.appendChild(botaoExcluir);
    }
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

            if (numeros[2] && !contadorComunicacoes) {
                numeros[2].textContent = quantidade;
            }
        },
        function (erro) {
            console.error(
                "Erro ao carregar contador de comunicações:",
                erro
            );
        }
    );
}

// ========================================
// LOGIN E ATUALIZAÇÕES EM TEMPO REAL
// ========================================

onAuthStateChanged(auth, function (usuario) {
    if (pararDeEscutarOcorrencias) {
        pararDeEscutarOcorrencias();
        pararDeEscutarOcorrencias = null;
    }

    if (pararDeEscutarComunicacoes) {
        pararDeEscutarComunicacoes();
        pararDeEscutarComunicacoes = null;
    }

    if (!usuario) {
        window.location.href = "../index.html";
        return;
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
                    titulo.textContent =
                        "Não foi possível carregar as atualizações";
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
