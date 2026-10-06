/**
 * O comando de jogo nas páginas de fora do mapa.
 *
 * O mapa é uma página; as paragens 360º e a folha dos controlos são
 * outras. Um comando só é ouvido dentro da página onde está, por isso o
 * que serve ao mapa não chega aqui — e sem isto, quem estivesse a olhar
 * uma rota 360º ou a ler os controlos tinha de largar o comando.
 *
 * Cada uma destas páginas é pequena e tem pouco onde mexer, por isso não
 * há aqui a maquinaria de contextos que o mapa tem. Isto olha para o que a
 * página tem e trata do que encontrar: se houver uma vista 360º, o stick
 * direito vira a cabeça e os gatilhos aproximam (LT) e afastam (RT); se
 * houver um filme, o A toca e pára; se houver um
 * menu de línguas, a cruz anda por ele; se houver um cartão de instruções
 * aberto, o B fecha-o; se não, e houver uma porta de saída, o B sai por ela.
 *
 * Uma paragem 360º aberta a partir do mapa é uma página destas dentro de
 * uma moldura, e aí há uma coisa que o navegador não deixa: um comando só
 * aparece a uma página depois de alguém lhe ter tocado com a página à
 * frente, e ninguém toca dentro da moldura. Perguntar por comandos lá
 * dentro dá sempre vazio, por muito que haja um ligado.
 *
 * Por isso, quando esta página está dentro de uma moldura, quem manda é o
 * mapa: ele vê o comando, e chama cá para dentro o que for preciso pelas
 * duas portas abaixo. Aberta sozinha, no seu próprio endereço, esta página
 * volta a olhar pelo comando por si mesma.
 *
 * Isto é um ficheiro comum, e não um módulo, para ser lido pelas três
 * páginas do mesmo modo que o ficheiro das línguas.
 */
(function () {
    'use strict';

    var BOTAO = {
        A: 0, B: 1, X: 2, Y: 3,
        LB: 4, RB: 5, LT: 6, RT: 7,
        SELECT: 8, START: 9,
        CIMA: 12, BAIXO: 13, ESQUERDA: 14, DIREITA: 15
    };

    // Onde o stick deixa de estar em repouso. Um comando parado nunca dá
    // exactamente zero, e sem esta folga a vista andava sozinha.
    var FOLGA_DO_STICK = 0.15;

    // Quanto se vira por segundo, com o stick todo para o lado. Meia volta
    // e um quarto: chega para dar a volta ao sítio sem tonturas.
    var GRAUS_POR_SEGUNDO = 110;

    // Até onde se pode olhar para cima e para baixo. É o que qualquer
    // visualizador destes faz: passar disto era ficar de cabeça para baixo.
    var LIMITE_VERTICAL = Math.PI / 2 - 0.02;

    // A cruz espera antes de começar a repetir, e depois repete a este
    // ritmo. São os tempos de um teclado.
    var ESPERA_ATE_REPETIR = 0.45;
    var INTERVALO_DA_REPETICAO = 0.12;

    // A partir de que ponto um gatilho conta como carregado: em repouso
    // raramente ficam a zero.
    var FOLGA_DO_GATILHO = 0.12;

    // Quantos passos de zoom por segundo dá um gatilho carregado até ao
    // fundo — os mesmos passos de um estalido da roda ou de uma tecla mais.
    // Do mais largo ao mais apertado vai pouco menos de dois segundos.
    var PASSOS_DE_ZOOM_POR_SEGUNDO = 5;

    // A classe que marca a linha escolhida. O desenho dela é posto abaixo,
    // para as páginas não terem todas de a saber de cor.
    var CLASSE_DO_FOCO = 'comando-foco';

    var antes = [];
    var mantido = {};
    var ultimoInstante = 0;
    var alvoAceso = null;

    /**
     * Põe na página o risco que marca a linha escolhida.
     */
    function vestirOFoco() {
        var estilo = document.createElement('style');
        estilo.textContent = '.' + CLASSE_DO_FOCO +
            ' { outline: 2px solid rgba(255,255,255,0.9); outline-offset: 2px; }';
        document.head.appendChild(estilo);
    }

    /**
     * Um comando ligado, ou nada.
     *
     * @returns {Gamepad|null} O comando.
     */
    function comandoLigado() {
        if (!navigator.getGamepads) return null;
        var todos = navigator.getGamepads();
        for (var i = 0; i < todos.length; i++) {
            if (todos[i] && todos[i].connected && todos[i].buttons && todos[i].buttons.length) {
                return todos[i];
            }
        }
        return null;
    }

    /**
     * Se um botão está carregado.
     *
     * @param {Gamepad} pad - O comando.
     * @param {number} n - O número do botão.
     * @returns {boolean} Se sim.
     */
    function carregado(pad, n) {
        var b = pad.buttons[n];
        if (!b) return false;
        return typeof b === 'object' ? b.pressed : b > 0.12;
    }

    /**
     * Se um botão acabou de ser carregado agora.
     *
     * @param {Gamepad} pad - O comando.
     * @param {number} n - O número do botão.
     * @returns {boolean} Se sim.
     */
    function bateuAgora(pad, n) {
        return carregado(pad, n) && !antes[n];
    }

    /**
     * Quanto os gatilhos pedem de zoom: o esquerdo aproxima, o direito
     * afasta. São analógicos — meio carregado, meia velocidade — e os dois
     * ao mesmo tempo anulam-se.
     *
     * @param {Gamepad} pad - O comando.
     * @returns {number} De menos um (afastar) a um (aproximar).
     */
    function gatilhos(pad) {
        var valor = function (n) {
            var b = pad.buttons[n];
            var v = !b ? 0 : (typeof b === 'object' ? b.value : b);
            return v > FOLGA_DO_GATILHO ? v : 0;
        };
        return valor(BOTAO.LT) - valor(BOTAO.RT);
    }

    /**
     * Aproxima ou afasta a vista da página, se ela souber fazê-lo.
     *
     * Cada página tem o seu zoom — a rota 360º e o Olho de Águia abrem e
     * fecham o ângulo por onde se olha — e diz como se lhe chega deixando
     * em `window.zoomDaPagina` uma função que recebe passos de zoom:
     * positivos para aproximar, negativos para afastar.
     *
     * @param {number} quanto - De menos um (afastar) a um (aproximar).
     * @param {number} dt - O tempo desde a imagem anterior, em segundos.
     * @returns {boolean} Se a página aproximou ou afastou.
     */
    function aproximar(quanto, dt) {
        var zoom = window.zoomDaPagina;
        if (!quanto || typeof zoom !== 'function') return false;
        zoom(quanto * PASSOS_DE_ZOOM_POR_SEGUNDO * dt);
        return true;
    }

    /**
     * A cruz, com repetição: uma pancada dá um passo, o dedo pousado dá
     * uma fila deles.
     *
     * @param {Gamepad} pad - O comando.
     * @param {number} n - O número do botão.
     * @param {number} dt - O tempo desde a imagem anterior.
     * @param {boolean} [eixo] - Um empurrão de stick que valha pelo mesmo.
     * @returns {boolean} Se deve dar um passo nesta imagem.
     */
    function passoDaCruz(pad, n, dt, eixo) {
        if (!carregado(pad, n) && !eixo) { mantido[n] = 0; return false; }
        var antesDisto = mantido[n] || 0;
        mantido[n] = antesDisto + dt;
        if (antesDisto === 0) return true;
        if (antesDisto < ESPERA_ATE_REPETIR) return false;
        var a = Math.floor((antesDisto - ESPERA_ATE_REPETIR) / INTERVALO_DA_REPETICAO);
        var b = Math.floor((mantido[n] - ESPERA_ATE_REPETIR) / INTERVALO_DA_REPETICAO);
        return b > a;
    }

    /**
     * Diz se um elemento está mesmo à vista e se pode carregar nele.
     *
     * @param {Element} el - O elemento.
     * @returns {boolean} Se sim.
     */
    function estaAVista(el) {
        if (!el || !el.isConnected || el.disabled) return false;
        var caixa = el.getBoundingClientRect();
        if (caixa.width < 1 || caixa.height < 1) return false;
        var estilo = window.getComputedStyle(el);
        if (estilo.display === 'none' || estilo.visibility === 'hidden') return false;
        return parseFloat(estilo.opacity) >= 0.05;
    }

    /**
     * Carrega num botão da página, se ele lá estiver e estiver à vista.
     *
     * @param {string} onde - Onde procurá-lo.
     * @returns {boolean} Se chegou a carregar.
     */
    function carregarEm(onde) {
        var el = document.querySelector(onde);
        if (!estaAVista(el)) return false;
        el.click();
        return true;
    }

    /**
     * Fecha o cartão das instruções, se estiver aberto, carregando na
     * cruz do canto dele.
     *
     * @returns {boolean} Se havia um cartão aberto para fechar.
     */
    function fecharInstrucoes() {
        return carregarEm('#instrucoes.aberta .instrucoes-fechar');
    }

    /**
     * O menu das línguas, se estiver aberto.
     *
     * @returns {Element|null} O menu.
     */
    function menuAberto() {
        var menu = document.getElementById('idioma-menu');
        return menu && menu.classList.contains('open') ? menu : null;
    }

    /**
     * As linhas de um menu por onde se pode andar.
     *
     * @param {Element} menu - O menu.
     * @returns {Element[]} O que lá dentro se pode escolher.
     */
    function linhasDoMenu(menu) {
        var tudo = menu.querySelectorAll('input[type="radio"], button, a[href]');
        return Array.prototype.filter.call(tudo, estaAVista);
    }

    /**
     * Acende a linha escolhida e apaga a anterior.
     *
     * @param {Element|null} el - A nova.
     */
    function acender(el) {
        if (alvoAceso === el) return;
        if (alvoAceso) alvoAceso.classList.remove(CLASSE_DO_FOCO);
        alvoAceso = el || null;
        if (alvoAceso) alvoAceso.classList.add(CLASSE_DO_FOCO);
    }

    /**
     * Anda com o foco pelo menu, dando a volta nas pontas.
     *
     * @param {Element} menu - O menu aberto.
     * @param {number} sentido - Menos um para trás, um para a frente.
     */
    function andarComOFoco(menu, sentido) {
        var lista = linhasDoMenu(menu);
        if (!lista.length) return;
        var i = lista.indexOf(alvoAceso);
        if (i < 0) i = sentido > 0 ? -1 : 0;
        i = (i + sentido + lista.length * 2) % lista.length;
        acender(lista[i]);
    }

    /**
     * Os comandos de olhar da cena 360º, quando ela já estiver de pé.
     *
     * A cena guarda a direcção do olhar em duas peças — uma para a volta
     * que se dá, outra para o levantar e baixar da cabeça — e é sobre elas
     * que o rato e o dedo trabalham. Mexendo nas mesmas, o comando entra na
     * fila sem empurrar ninguém.
     *
     * @returns {object|null} As duas peças.
     */
    function olhar() {
        var camara = document.querySelector('[look-controls]');
        var peca = camara && camara.components && camara.components['look-controls'];
        return (peca && peca.yawObject && peca.pitchObject) ? peca : null;
    }

    /**
     * Vira a cabeça da vista 360º.
     *
     * @param {number} x - Quanto para o lado, de menos um a um.
     * @param {number} y - Quanto para cima e para baixo.
     * @param {number} dt - O tempo desde a imagem anterior, em segundos.
     */
    function virarACabeca(x, y, dt) {
        if (Math.abs(x) <= FOLGA_DO_STICK && Math.abs(y) <= FOLGA_DO_STICK) return;
        var peca = olhar();
        if (!peca) return;
        var angulo = GRAUS_POR_SEGUNDO * Math.PI / 180 * dt;
        if (Math.abs(x) > FOLGA_DO_STICK) peca.yawObject.rotation.y -= x * angulo;
        if (Math.abs(y) > FOLGA_DO_STICK) {
            peca.pitchObject.rotation.x = Math.max(-LIMITE_VERTICAL, Math.min(
                LIMITE_VERTICAL, peca.pitchObject.rotation.x - y * angulo));
        }
    }

    /**
     * Uma imagem de trabalho.
     *
     * @param {number} agora - O instante, em milésimos de segundo.
     */
    function passo(agora) {
        window.requestAnimationFrame(passo);

        var dt = ultimoInstante ? Math.min((agora - ultimoInstante) / 1000, 0.1) : 0;
        ultimoInstante = agora;

        var pad = comandoLigado();
        if (!pad) { antes = []; if (alvoAceso) acender(null); return; }

        var menu = menuAberto();

        // --- Virar a cabeça, com o stick direito, e aproximar e afastar,
        // com os gatilhos ---
        if (!menu) {
            virarACabeca(pad.axes[2] || 0, pad.axes[3] || 0, dt);
            aproximar(gatilhos(pad), dt);
        }

        var esquerdo = pad.axes[0] || 0;
        var vertical = pad.axes[1] || 0;
        var cima = passoDaCruz(pad, BOTAO.CIMA, dt, vertical < -0.5);
        var baixo = passoDaCruz(pad, BOTAO.BAIXO, dt, vertical > 0.5);
        var esquerda = passoDaCruz(pad, BOTAO.ESQUERDA, dt, menu && esquerdo < -0.5);
        var direita = passoDaCruz(pad, BOTAO.DIREITA, dt, menu && esquerdo > 0.5);

        if (menu) {
            // Com o menu das línguas aberto, a cruz anda por ele e mais nada.
            if (cima) andarComOFoco(menu, -1);
            if (baixo) andarComOFoco(menu, 1);
            if (bateuAgora(pad, BOTAO.A) && alvoAceso) alvoAceso.click();
            if (bateuAgora(pad, BOTAO.B) || bateuAgora(pad, BOTAO.SELECT) ||
                bateuAgora(pad, BOTAO.START)) {
                menu.classList.remove('open');
                acender(null);
            }
            guardar(pad);
            return;
        }

        // --- O filme, onde houver filme ---
        if (bateuAgora(pad, BOTAO.A)) {
            if (!carregarEm('#play-pause-btn')) carregarEm('#play-btn-initial');
        }
        if (esquerda) carregarEm('#recuar-btn');
        if (direita) carregarEm('#avancar-btn');
        if (bateuAgora(pad, BOTAO.X)) carregarEm('#volume-btn');

        // --- Ecrã inteiro ---
        if (bateuAgora(pad, BOTAO.Y)) carregarEm('#fullscreen-btn');

        // --- As línguas ---
        if (bateuAgora(pad, BOTAO.SELECT) || bateuAgora(pad, BOTAO.START)) {
            carregarEm('#idioma-botao');
        }

        // --- As instruções, e depois a porta de saída ---
        // Com o cartão das instruções aberto, o B fecha-o. Sem ele, sai
        // pela porta — só nas páginas que tenham uma. Numa paragem 360º não
        // há, e o B fica para quem está de fora fechar a janela.
        if (bateuAgora(pad, BOTAO.B) && !fecharInstrucoes()) carregarEm('.back-link');

        guardar(pad);
    }

    /**
     * Guarda o que está carregado, para a imagem seguinte saber o que é
     * novo.
     *
     * @param {Gamepad} pad - O comando.
     */
    function guardar(pad) {
        antes = [];
        for (var i = 0; i < pad.buttons.length; i++) antes[i] = carregado(pad, i);
    }

    /**
     * As portas por onde o mapa manda cá para dentro.
     *
     * Virar a cabeça é preciso a cada imagem, com o quanto e o quanto tempo;
     * carregar num botão, ou numa tecla, é de uma vez. São as únicas coisas
     * que de fora se não alcançam de outra maneira.
     */
    /**
     * Se quem carregou na tecla estava a escrever num campo.
     *
     * @param {KeyboardEvent} e - A tecla.
     * @returns {boolean} Se sim.
     */
    function aEscrever(e) {
        var alvo = e.target;
        return !!(alvo && alvo.tagName && /^(?:INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName));
    }

    // --- Virar a cabeça de teclado: o W, A, S, D e as setas com o Alt ---
    //
    // O W, A, S e D viram a cabeça como no bairro fazem andar: o A e o D
    // para os lados, o W e o S para cima e para baixo. As setas fazem o
    // mesmo com o Alt em baixo — é a combinação do mapa, e pela mesma
    // razão: aqui as setas sozinhas já servem para saltar no filme e mexer
    // no som, e o Alt é o que as põe a virar a cabeça sem tirar nada a
    // ninguém. As letras olham-se pelo lugar da tecla, para o W, A, S e D
    // serem as mesmas quatro teclas juntas em qualquer teclado.
    //
    // Uma tecla carregada é uma coisa que dura, não um aviso que passa:
    // fica anotada enquanto está em baixo, e a cada imagem vira-se a
    // cabeça pelo que estiver anotado.
    (function ligarAsTeclasDeOlhar() {
        var SETAS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
        var LETRAS = { KeyA: [-1, 0], KeyD: [1, 0], KeyW: [0, -1], KeyS: [0, 1] };

        // Um toque só na tecla dá um empurrão deste tamanho, em segundos
        // de tecla segurada: chega para se notar, e não passa disso.
        var TOQUE = 0.08;

        var carregadas = {};
        var ultimo = 0;

        /**
         * O lugar da tecla — ou, se o teclado não o disser, a letra.
         *
         * @param {KeyboardEvent} e - A tecla.
         * @returns {string} O nome do lugar, como `KeyW`.
         */
        function lugarDa(e) {
            if (e.code) return e.code;
            return e.key && e.key.length === 1 ? 'Key' + e.key.toUpperCase() : '';
        }

        window.addEventListener('keydown', function (e) {
            // Só teclas verdadeiras: uma mandada de fora nunca se larga.
            if (!e.isTrusted || e.ctrlKey || e.metaKey || aEscrever(e)) return;
            var lugar = lugarDa(e);
            var nova = null;
            if (!e.altKey && LETRAS[lugar]) {
                nova = carregadas[lugar] ? null : LETRAS[lugar];
                carregadas[lugar] = LETRAS[lugar];
                e.preventDefault();
            } else if (e.altKey && SETAS[e.key]) {
                nova = carregadas[e.key] ? null : SETAS[e.key];
                carregadas[e.key] = SETAS[e.key];
                e.preventDefault();
            }
            // Um toque dá logo um empurrão: assim a tecla responde mesmo
            // que seja largada antes de a imagem seguinte a ver.
            if (nova && !e.repeat) virarACabeca(nova[0], nova[1], TOQUE);
        });
        window.addEventListener('keyup', function (e) {
            delete carregadas[lugarDa(e)];
            delete carregadas[e.key];
            // Largado o Alt, as setas deixam de olhar — mesmo as que ainda
            // estejam em baixo.
            if (!e.altKey) {
                for (var seta in SETAS) delete carregadas[seta];
            }
        });
        window.addEventListener('blur', function () { carregadas = {}; });

        (function volta(agora) {
            window.requestAnimationFrame(volta);
            var dt = ultimo ? Math.min((agora - ultimo) / 1000, 0.1) : 0;
            ultimo = agora;
            var x = 0, y = 0;
            for (var tecla in carregadas) {
                x += carregadas[tecla][0];
                y += carregadas[tecla][1];
            }
            if (x || y) virarACabeca(Math.max(-1, Math.min(1, x)), Math.max(-1, Math.min(1, y)), dt);
        })(0);
    })();

    // --- As teclas que são do mapa ---
    //
    // Dentro de uma moldura, o Escape e as setas dos lados são do mapa:
    // fecham a janela e passam à paragem do lado. Mas o navegador entrega
    // cada tecla só à página que tem o foco, e quem carregou na imagem
    // para olhar à volta tem o foco cá dentro — lá fora não chegava nada.
    // Por isso estas três passam-se para fora, à mão. Só as verdadeiras: as
    // que o mapa manda cá para dentro não voltam a sair, senão andavam
    // para trás e para a frente sem parar.
    if (window.parent !== window) {
        window.addEventListener('keydown', function (e) {
            if (!e.isTrusted || e.altKey || e.ctrlKey || e.metaKey || aEscrever(e)) return;
            if (e.key !== 'Escape' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
            try {
                var fora = window.parent;
                fora.document.dispatchEvent(new fora.KeyboardEvent('keydown', {
                    key: e.key, code: e.code, bubbles: true, cancelable: true
                }));
            } catch (erro) { /* outra origem: o mapa não se alcança */ }
        });
    }

    window.comandoDaJanela = {
        /**
         * Vira a cabeça, como se o stick direito estivesse a ser empurrado.
         *
         * @param {number} x - Quanto para o lado, de menos um a um.
         * @param {number} y - Quanto para cima e para baixo.
         * @param {number} dt - O tempo desde a imagem anterior, em segundos.
         */
        olhar: function (x, y, dt) {
            virarACabeca(x, y, dt);
        },
        /**
         * Aproxima ou afasta a vista, como se os gatilhos estivessem a ser
         * carregados.
         *
         * @param {number} quanto - De menos um (afastar) a um (aproximar).
         * @param {number} dt - O tempo desde a imagem anterior, em segundos.
         * @returns {boolean} Se a página aproximou ou afastou.
         */
        aproximar: function (quanto, dt) {
            return aproximar(quanto, dt);
        },
        /**
         * Carrega num botão desta página.
         *
         * @param {string} nome - O nome do botão, sem o cardinal.
         * @returns {boolean} Se chegou a carregar.
         */
        botao: function (nome) {
            if (nome === 'tocar') {
                return carregarEm('#play-pause-btn') || carregarEm('#play-btn-initial');
            }
            return carregarEm('#' + nome);
        },
        /**
         * Fecha o cartão das instruções desta página, se estiver aberto.
         * É o que o B faz primeiro, antes de fechar a janela lá fora.
         *
         * @returns {boolean} Se havia um cartão aberto para fechar.
         */
        fecharInstrucoes: function () {
            return fecharInstrucoes();
        },
        /**
         * Carrega numa tecla desta página, como se alguém lhe tivesse
         * carregado com o foco cá dentro.
         *
         * É por aqui que o mapa passa para dentro as teclas do filme —
         * o espaço, o M, os números — quando o foco está lá fora. As
         * teclas que se seguram, como o W, A, S e D, não vêm por aqui:
         * uma tecla mandada de fora nunca se larga, e a cabeça ficava a
         * virar para sempre. Para essas há o `olhar`, a cada imagem.
         *
         * @param {object} dados - O nome da tecla (`key`), o lugar dela
         *     (`code`) e se o Shift estava em baixo (`shiftKey`).
         */
        tecla: function (dados) {
            document.dispatchEvent(new KeyboardEvent('keydown', {
                key: dados.key,
                code: dados.code || '',
                shiftKey: !!dados.shiftKey,
                bubbles: true,
                cancelable: true
            }));
        }
    };

    vestirOFoco();

    // Dentro de uma moldura não vale a pena andar a perguntar por comandos:
    // o navegador nunca os mostra aqui. Quem trata disso é o mapa, lá fora.
    if (window.parent === window) {
        window.requestAnimationFrame(passo);
    }
})();
