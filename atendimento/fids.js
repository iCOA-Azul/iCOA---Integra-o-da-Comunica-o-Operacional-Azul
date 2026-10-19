
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

const form = document.getElementById("formFids");
const aviso = document.getElementById("avisoSistema");
const botaoSalvar = document.getElementById("botaoSalvar");
const botaoCancelar = document.getElementById("botaoCancelar");

const vooId = document.getElementById("vooId");
const numeroVoo = document.getElementById("numeroVoo");
const origem = document.getElementById("origem");
const destino = document.getElementById("destino");
const statusVoo = document.getElementById("statusVoo");
const horario = document.getElementById("horario");
const mensagem = document.getElementById("mensagem");

const listaVoos = document.getElementById("listaVoos");
const mensagemVazia = document.getElementById("mensagemVazia");
const totalVoos = document.getElementById("totalVoos");
const totalAcompanhamento = document.getElementById("totalAcompanhamento");
const mensagemDestaque = document.getElementById("mensagemDestaque");
const ultimaAtualizacao = document.getElementById("ultimaAtualizacao");

const COLECAO = "telaoVoos";
const EMAIL_ATENDIMENTO = "atendimento@icoa.com";

let usuarioAtual = null;
let voos = [];
let cancelarEscuta = null;
let salvando = false;

function mostrarAviso(texto, tipo = "") {
    aviso.textContent = texto;
    aviso.className = "aviso";

    if (tipo) {
        aviso.classList.add(tipo);
    }
}

function escaparHTML(valor = "") {
    return String(valor).replace(/[&<>"']/g, caractere => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[caractere]);
}

function classeStatus(status) {
    const classes = {
        "Programado": "status-programado",
        "Embarque": "status-embarque",
        "Em acompanhamento": "status-acompanhamento",
        "Atrasado": "status-atrasado",
        "Cancelado": "status-cancelado",
        "Concluído": "status-concluido"
    };

    return classes[status] || "status-programado";
}

function formatarHorario(valor) {
    return valor ? escaparHTML(valor) : "A confirmar";
}

function formatarData(data) {
    if (!data) return "";

    const dataJS = typeof data.toDate === "function"
        ? data.toDate()
        : new Date(data);

    if (Number.isNaN(dataJS.getTime())) return "";

    return dataJS.toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short"
    });
}

function limparFormulario() {
    form.reset();
    vooId.value = "";
    botaoSalvar.textContent = "Publicar no telão";
    botaoCancelar.hidden = true;
}

function preencherFormulario(id) {
    const voo = voos.find(item => item.id === id);

    if (!voo || usuarioAtual?.email !== EMAIL_ATENDIMENTO) {
        return;
    }

    vooId.value = voo.id;
    numeroVoo.value = voo.voo || "";
    origem.value = voo.origem || "";
    destino.value = voo.destino || "";
    statusVoo.value = voo.status || "Programado";
    horario.value = voo.horario || "";
    mensagem.value = voo.mensagem || "";

    botaoSalvar.textContent = "Salvar alterações";
    botaoCancelar.hidden = false;

    form.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

function renderizarVoos() {
    totalVoos.textContent = voos.length;

    totalAcompanhamento.textContent = voos.filter(
        voo => voo.status === "Em acompanhamento"
    ).length;

    if (voos.length === 0) {
        listaVoos.innerHTML = `
            <tr>
                <td colspan="5" class="estado-vazio">
                    Nenhum voo publicado no momento.
                </td>
            </tr>
        `;

        mensagemVazia.hidden = false;
        mensagemDestaque.textContent =
            "Consulte as informações disponíveis. " +
            "Novas atualizações serão exibidas quando publicadas.";

        return;
    }

    mensagemVazia.hidden = true;

    listaVoos.innerHTML = voos.map(voo => {
        const status = voo.status || "Programado";

        return `
            <tr>
                <td class="voo-numero">
                    ${escaparHTML(voo.voo)}
                </td>

                <td>${escaparHTML(voo.origem)}</td>

                <td>${escaparHTML(voo.destino)}</td>

                <td>${formatarHorario(voo.horario)}</td>

                <td>
                    <span class="status ${classeStatus(status)}">
                        ${escaparHTML(status)}
                    </span>

                    ${usuarioAtual?.email === EMAIL_ATENDIMENTO ? `
                        <div class="acoes-voo">
                            <button
                                type="button"
                                class="botao-editar"
                                data-acao="editar"
                                data-id="${escaparHTML(voo.id)}"
                            >Editar</button>

                            <button
                                type="button"
                                class="botao-excluir"
                                data-acao="excluir"
                                data-id="${escaparHTML(voo.id)}"
                            >Retirar</button>
                        </div>
                    ` : ""}
                </td>
            </tr>
        `;
    }).join("");

    const destaque = voos.find(
        voo => voo.mensagem && voo.mensagem.trim()
    );

    mensagemDestaque.textContent = destaque
        ? destaque.mensagem
        : "Consulte as informações disponíveis. " +
          "Novas atualizações serão exibidas quando publicadas.";

    const maisRecente = voos.find(voo => voo.atualizadoEm);

    ultimaAtualizacao.textContent = maisRecente
        ? `Última atualização: ${formatarData(maisRecente.atualizadoEm)}`
        : "Aguardando a primeira atualização.";
}

function iniciarEscuta() {
    if (cancelarEscuta) {
        cancelarEscuta();
    }

    cancelarEscuta = onSnapshot(
        collection(db, COLECAO),

        snapshot => {
            voos = snapshot.docs.map(documento => ({
                id: documento.id,
                ...documento.data()
            }));

            voos.sort((a, b) => {
                const dataA = a.atualizadoEm?.toMillis?.() || 0;
                const dataB = b.atualizadoEm?.toMillis?.() || 0;

                return dataB - dataA;
            });

            renderizarVoos();

            mostrarAviso(
                usuarioAtual.email === EMAIL_ATENDIMENTO
                    ? "Sistema conectado. Você pode gerenciar os voos."
                    : "Informações dos voos carregadas.",
                "sucesso"
            );
        },

        erro => {
            console.error("Erro ao carregar o FIDS:", erro);

            mostrarAviso(
                "Não foi possível carregar os voos. " +
                "Verifique sua conexão e as regras do Firebase.",
                "erro"
            );
        }
    );
}

form.addEventListener("submit", async evento => {
    evento.preventDefault();

    if (salvando) return;

    if (!usuarioAtual || usuarioAtual.email !== EMAIL_ATENDIMENTO) {
        mostrarAviso(
            "Somente o setor de Atendimento pode alterar o telão.",
            "erro"
        );
        return;
    }

    const dados = {
        voo: numeroVoo.value.trim().toUpperCase(),
        origem: origem.value.trim(),
        destino: destino.value.trim(),
        status: statusVoo.value,
        horario: horario.value,
        mensagem: mensagem.value.trim(),
        atualizadoEm: serverTimestamp()
    };

    if (!dados.voo || !dados.origem || !dados.destino) {
        mostrarAviso(
            "Preencha o número do voo, a origem e o destino.",
            "erro"
        );
        return;
    }

    salvando = true;
    botaoSalvar.disabled = true;

    try {
        if (vooId.value) {
            await updateDoc(
                doc(db, COLECAO, vooId.value),
                dados
            );

            mostrarAviso("Informações do voo atualizadas.", "sucesso");
        } else {
            await addDoc(collection(db, COLECAO), {
                ...dados,
                criadoPorUid: usuarioAtual.uid,
                criadoEm: serverTimestamp()
            });

            mostrarAviso("Voo publicado no telão.", "sucesso");
        }

        limparFormulario();
    } catch (erro) {
        console.error("Erro ao salvar voo:", erro);

        mostrarAviso(
            "Não foi possível salvar. Verifique o login e as regras do Firebase.",
            "erro"
        );
    } finally {
        salvando = false;
        botaoSalvar.disabled = false;
    }
});

botaoCancelar.addEventListener("click", limparFormulario);

listaVoos.addEventListener("click", async evento => {
    const botao = evento.target.closest("button[data-acao]");

    if (!botao) return;

    if (usuarioAtual?.email !== EMAIL_ATENDIMENTO) {
        mostrarAviso(
            "Somente o Atendimento pode gerenciar os voos.",
            "erro"
        );
        return;
    }

    const id = botao.dataset.id;

    if (botao.dataset.acao === "editar") {
        preencherFormulario(id);
        return;
    }

    if (botao.dataset.acao === "excluir") {
        const voo = voos.find(item => item.id === id);

        if (!voo) return;

        const confirmar = window.confirm(
            `Deseja retirar o voo ${voo.voo} do telão?`
        );

        if (!confirmar) return;

        try {
            await deleteDoc(doc(db, COLECAO, id));

            if (vooId.value === id) {
                limparFormulario();
            }

            mostrarAviso("Voo retirado do telão.", "sucesso");
        } catch (erro) {
            console.error("Erro ao retirar voo:", erro);

            mostrarAviso(
                "Não foi possível retirar o voo. Verifique as regras do Firebase.",
                "erro"
            );
        }
    }
});

onAuthStateChanged(auth, usuario => {
    usuarioAtual = usuario;

    if (!usuario) {
        form.hidden = true;

        if (cancelarEscuta) {
            cancelarEscuta();
            cancelarEscuta = null;
        }

        voos = [];
        renderizarVoos();

        mostrarAviso(
            "Faça login no iCOA para visualizar as informações dos voos.",
            "erro"
        );

        return;
    }

    form.hidden = usuario.email !== EMAIL_ATENDIMENTO;

    if (usuario.email === EMAIL_ATENDIMENTO) {
        mostrarAviso(
            "Acesso autorizado ao gerenciamento do FIDS."
        );
    } else {
        mostrarAviso(
            "Modo de visualização: somente funcionários autorizados " +
            "podem alterar as informações."
        );
    }

    iniciarEscuta();
});
