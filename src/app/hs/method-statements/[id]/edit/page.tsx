import { AssessmentEdit } from '../../../assessments/AssessmentPages';

export default function EditMethodStatementPage({ params }: { params: { id: string } }) {
  return <AssessmentEdit kind="METHOD_STATEMENT" id={params.id} />;
}
