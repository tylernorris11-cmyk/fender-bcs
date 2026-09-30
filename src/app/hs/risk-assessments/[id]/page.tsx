import { AssessmentDetail } from '../../assessments/AssessmentPages';

export default function RiskAssessmentPage({ params }: { params: { id: string } }) {
  return <AssessmentDetail kind="RISK_ASSESSMENT" id={params.id} />;
}
