import React from 'react';
import '../../styles/PageButtons.scss';

type Props = {
  page: number;
  loading: boolean;
  onPrev: () => void;
  onNext: () => void;
  disableNext?: boolean;
};

const PageButtonsTop: React.FC<Props> = ({ page, loading, onPrev, onNext, disableNext }) => {
  return (
    <div className="page-buttons">
      <button onClick={onPrev} disabled={page <= 1 || loading} className="left">
        <div>Prev</div>
      </button>
      <span>Page {page}</span>
      <button onClick={onNext} disabled={disableNext || loading} className="right">
        <div>Next</div>
      </button>
    </div>
  );
};

export default PageButtonsTop;
