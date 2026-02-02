import React from 'react';
import '../../styles/PageButtons.scss';

type Props = {
  page: number;
  loading: boolean;
  onPrev: () => void;
  onNext: () => void;
  disableNext?: boolean;
};

const PageButtonsBottom: React.FC<Props> = ({ page, loading, onPrev, onNext, disableNext }) => {
  return (
    <div className="page-buttons">
      <button onClick={onPrev} disabled={page <= 1 || loading} className="left">
        Prev
      </button>
      <span>Page {page}</span>
      <button onClick={onNext} disabled={disableNext || loading} className="right">
        Next
      </button>
    </div>
  );
};

export default PageButtonsBottom;
