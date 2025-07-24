import { Button, Collapse, Skeleton } from "antd";
import { useState } from "react";
import styled from "styled-components";

const StyledCollapse = styled(Collapse)`
  &.ant-collapse-borderless > .ant-collapse-item {
    border-bottom: 1px solid #f0f0f0;
  }
`;

const Container = styled.div`
  position: relative;
  margin-bottom: 1.5rem;
`;

const Overlay = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: linear-gradient(
    to top,
    rgba(255, 255, 255, 0.9),
    rgba(255, 255, 255, 0.5)
  );
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom-left-radius: 4px;
  border-bottom-right-radius: 4px;
  z-index: 1;
`;

type LoadableCollapseProps = {
  panels: React.ReactNode[];
  loading?: boolean;
};

export const LoadableCollapse: React.FC<LoadableCollapseProps> = ({
  panels,
  loading,
}) => {
  if (loading) {
    return <Skeleton active paragraph={{ rows: 3 }} />;
  }

  const [expanded, setExpanded] = useState(false);
  const visiblePanels = expanded ? panels : panels.slice(0, 3);

  return (
    <Container>
      <StyledCollapse
        accordion
        bordered={false}
        style={{ background: "transparent", borderRadius: 6 }}
      >
        {visiblePanels}
      </StyledCollapse>

      {!expanded && panels.length > 5 && (
        <Overlay>
          <Button type="link" onClick={() => setExpanded(true)}>
            Show {panels.length - 3} more...
          </Button>
        </Overlay>
      )}
    </Container>
  );
};
