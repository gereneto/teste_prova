import { HashRouter, Navigate, Route, Routes } from 'react-router'
import { Area, RolarParaTopo } from './components/Layout'
import PainelEscola from './pages/coordenacao/PainelEscola'
import ProfessoresEscola from './pages/coordenacao/ProfessoresEscola'
import TurmaDetalhe from './pages/coordenacao/TurmaDetalhe'
import TurmasEscola from './pages/coordenacao/TurmasEscola'
import Entrada from './pages/Entrada'
import MinhasTurmas from './pages/professor/MinhasTurmas'
import AvaliacaoDetalhe from './pages/solar/AvaliacaoDetalhe'
import Avaliacoes from './pages/solar/Avaliacoes'
import ColegioDetalhe from './pages/solar/ColegioDetalhe'
import Colegios from './pages/solar/Colegios'
import Configuracoes from './pages/solar/Configuracoes'
import Estatisticas from './pages/solar/Estatisticas'
import PainelRede from './pages/solar/PainelRede'
import FolhasResposta from './pages/turma/FolhasResposta'
import Lancamento from './pages/turma/Lancamento'
import ResultadosTurma from './pages/turma/ResultadosTurma'

// HashRouter (endereços com #) funciona no GitHub Pages sem configuração de servidor.
export default function App() {
  return (
    <HashRouter>
      <RolarParaTopo />
      <Routes>
        <Route path="/" element={<Entrada />} />
        <Route path="/professor" element={<Area papel="professor" />}>
          <Route index element={<MinhasTurmas />} />
          <Route path="lancar/:cadernoId/:turmaId" element={<Lancamento />} />
          <Route path="resultados/:cadernoId/:turmaId" element={<ResultadosTurma />} />
        </Route>
        <Route path="/coordenacao" element={<Area papel="coordenacao" />}>
          <Route index element={<PainelEscola />} />
          <Route path="turmas" element={<TurmasEscola />} />
          <Route path="turmas/:turmaId" element={<TurmaDetalhe />} />
          <Route path="professores" element={<ProfessoresEscola />} />
          <Route path="lancar/:cadernoId/:turmaId" element={<Lancamento />} />
          <Route path="resultados/:cadernoId/:turmaId" element={<ResultadosTurma />} />
        </Route>
        <Route path="/solar" element={<Area papel="solar" />}>
          <Route index element={<PainelRede />} />
          <Route path="colegios" element={<Colegios />} />
          <Route path="colegios/:colegioId" element={<ColegioDetalhe />} />
          <Route path="avaliacoes" element={<Avaliacoes />} />
          <Route path="avaliacoes/:avaliacaoId" element={<AvaliacaoDetalhe />} />
          <Route path="estatisticas" element={<Estatisticas />} />
          <Route path="configuracoes" element={<Configuracoes />} />
        </Route>
        <Route path="/imprimir/folhas/:cadernoId/:turmaId" element={<FolhasResposta />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
