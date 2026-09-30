import { AssessmentPrint } from '../../../assessments/AssessmentPages';

export default function PrintRiskAssessmentPage({ params }: { params: { id: string } }) {
  return <AssessmentPrint kind="RISK_ASSESSMENT" id={params.id} />;
}
