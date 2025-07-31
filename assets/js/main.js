document.addEventListener('DOMContentLoaded', () => {
    // Verifica se está na página da calculadora
    if (!document.body.classList.contains('tool-page') || !document.getElementById('projection-chart')) {
        return;
    }

    // --- Seletores de Elementos ---
    const presentValueInput = document.getElementById('present-value');
    const interestRateInput = document.getElementById('interest-rate');
    const contributionInput = document.getElementById('contribution');
    const timeInput = document.getElementById('time');
    const calculateBtn = document.getElementById('calculate-btn');
    const resultsSummary = document.getElementById('results-summary');
    const chartCanvas = document.getElementById('projection-chart').getContext('2d');
    
    const interestPeriodSelect = document.getElementById('interest-period');
    const contributionPeriodSelect = document.getElementById('contribution-period');
    const timePeriodSelect = document.getElementById('time-period');

    let projectionChart;

    // --- Máscaras de Input (IMask.js) ---
    const currencyMaskOptions = { mask: 'R$ num', blocks: { num: { mask: Number, thousandsSeparator: '.', scale: 2, padFractionalZeros: true, radix: ',', mapToRadix: ['.'] } } };
    const percentMaskOptions = { mask: 'num %', blocks: { num: { mask: Number, scale: 2, padFractionalZeros: true, radix: ',', mapToRadix: ['.'] } } };
    
    const pvMask = IMask(presentValueInput, currencyMaskOptions);
    const irMask = IMask(interestRateInput, percentMaskOptions);
    const ctMask = IMask(contributionInput, currencyMaskOptions);

    // --- Lógica Principal ---
    calculateBtn.addEventListener('click', calculateAndDisplay);

    function initializeChart() {
        if (projectionChart) {
            projectionChart.destroy();
        }
        resultsSummary.innerHTML = '<div class="result-box"><h3>Aguardando cálculo...</h3><p>Preencha os campos e clique em calcular.</p></div>';
        projectionChart = new Chart(chartCanvas, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Total Acumulado',
                        data: [],
                        borderColor: '#00796b',
                        backgroundColor: 'rgba(0, 121, 107, 0.1)',
                        fill: true,
                        tension: 0.1
                    },
                    {
                        label: 'Total Investido',
                        data: [],
                        borderColor: '#757575',
                        borderDash: [5, 5],
                        fill: false,
                        tension: 0.1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { ticks: { callback: value => `R$ ${value.toLocaleString('pt-BR')}` } },
                    x: { ticks: { maxRotation: 0, minRotation: 0, autoSkipPadding: 20, callback: function(value) { return this.getLabelForValue(value) + 'm'; } } }
                },
                plugins: { tooltip: { callbacks: { label: context => ` ${context.dataset.label}: R$ ${context.parsed.y.toLocaleString('pt-BR', {minimumFractionDigits: 2})}` } } }
            }
        });
    }

    function parseMaskedValue(unmaskedValue) {
        if (!unmaskedValue) return 0;
        const sanitized = unmaskedValue.replace(/\./g, '').replace(',', '.');
        return parseFloat(sanitized) || 0;
    }

    function calculateAndDisplay() {
        try {
            const pv = parseMaskedValue(pvMask.unmaskedValue);
            const ir = parseMaskedValue(irMask.unmaskedValue);
            const contribution = parseMaskedValue(ctMask.unmaskedValue);

            if (ir <= 0 || !timeInput.value || parseFloat(timeInput.value) <= 0) {
                throw new Error("Preencha os campos de Taxa de Juros e Tempo com valores válidos maiores que zero.");
            }

            let monthlyInterestRate = ir / 100;
            let monthlyContribution = contribution;
            let totalMonths = parseInt(timeInput.value, 10);

            if (interestPeriodSelect.value === 'yearly') {
                monthlyInterestRate = Math.pow(1 + monthlyInterestRate, 1/12) - 1;
            }
            if (contributionPeriodSelect.value === 'yearly') {
                monthlyContribution = monthlyContribution / 12;
            }
            if (timePeriodSelect.value === 'years') {
                totalMonths = totalMonths * 12;
            }
            
            const labels = [];
            const totalAccumulatedData = [];
            const totalInvestedData = [];
            let futureValue = pv;
            let totalInvested = pv;
            
            for (let month = 0; month <= totalMonths; month++) {
                labels.push(month);
                totalAccumulatedData.push(parseFloat(futureValue.toFixed(2)));
                totalInvestedData.push(parseFloat(totalInvested.toFixed(2)));

                if (month < totalMonths) {
                    futureValue *= (1 + monthlyInterestRate);
                    futureValue += monthlyContribution;
                    totalInvested += monthlyContribution;
                }
            }
            
            const totalInterest = futureValue - totalInvested;
            resultsSummary.innerHTML = `
                <div class="result-box">
                    <h3>Valor Final Bruto</h3>
                    <p>R$ ${futureValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                </div>
                <div class="result-box">
                    <h3>Total Investido</h3>
                    <p>R$ ${totalInvested.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                </div>
                <div class="result-box">
                    <h3>Total em Juros</h3>
                    <p class="positive">R$ ${totalInterest.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                </div>
            `;

            // Atualiza os dados do gráfico
            projectionChart.data.labels = labels;
            projectionChart.data.datasets[0].data = totalAccumulatedData;
            projectionChart.data.datasets[1].data = totalInvestedData;
            
            // ==================================================================
            // == CORREÇÃO APLICADA AQUI ========================================
            // Altera a formatação do Eixo X com base na seleção do usuário
            // ==================================================================
            if (timePeriodSelect.value === 'years') {
                projectionChart.options.scales.x.ticks.callback = function(value) {
                    const label = this.getLabelForValue(value);
                    // Só exibe o rótulo se for um ano inteiro (múltiplo de 12 meses)
                    if (label % 12 === 0) {
                        return (label / 12) + 'a'; // 'a' de anos
                    }
                    return null; // Oculta rótulos intermediários (ex: mês 13, 14, etc.)
                };
            } else {
                projectionChart.options.scales.x.ticks.callback = function(value) {
                    return this.getLabelForValue(value) + 'm'; // 'm' de meses
                };
            }

            // Atualiza o gráfico para aplicar as novas configurações e dados
            projectionChart.update();

        } catch (error) {
            console.error("Erro no cálculo:", error);
            resultsSummary.innerHTML = `<div class="result-box error"><h3>Erro no Cálculo</h3><p>${error.message}</p></div>`;
            projectionChart.data.labels = [];
            projectionChart.data.datasets.forEach(dataset => { dataset.data = []; });
            projectionChart.update();
        }
    }
    
    initializeChart();
});