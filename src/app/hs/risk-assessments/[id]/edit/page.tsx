import { AssessmentEdit } from '../../../assessments/AssessmentPages';

export default function EditRiskAssessmentPage({ params }: { params: { id: string } }) {
  return <AssessmentEdit kind="RISK_ASSESSMENT" id={params.id} />;
}
