import React, { useEffect, useState } from 'react';
import { ArtCard } from '../../components/ArtCard';
import { Layout, Row, Col, Tabs } from 'antd';
import Masonry from 'react-masonry-css';
import { Link } from 'react-router-dom';
import { useCreatorArts, useUserArts } from '../../hooks';
import { useMeta } from '../../contexts';
import { CardLoader } from '../../components/MyLoader';
import { useWallet } from '@solana/wallet-adapter-react';
import { ArtType } from '../../types';
import { useArt } from '../../hooks';
import { redeemFullRightsTransferBid } from '@oyster/common';
//import { useParams } from 'react-router-dom';

const { TabPane } = Tabs;

const { Content } = Layout;

export enum ArtworkViewState {
  Metaplex = '0',
  Owned = '1',
  Created = '2',
}

const prints = [
  /*prints*/ 'AkNQXGbSLPv5t6Y1VHaGTZJMX8cFzqoLE1tQLjykJqNb', //scimitar
  '7RSkMv1pL9twZWoGMVaT2w45NcvipAQvFYprNWM1Rosq', //eyeglass1
  '4mN9jjumAxJCp3nrzw6yo1E59GTmKmjkWRED6G3wdJCZ', //eyeglass2
  '33P1SEiwerJoNXiby9GL56KBVpWPNsokQdZicfetUbZ3', //headaxe
  'Cb4nUaJpX3xDeYGJ3QtkrjEWLpkvsaR3LSanWYMopoA1', //rod
];

export const ArtworksView = () => {
  const { connected, publicKey } = useWallet();
  const ownedMetadata = useUserArts();
  const createdMetadata = useCreatorArts(publicKey?.toBase58() || '');
  const { metadata, isLoading } = useMeta();
  const [activeKey, setActiveKey] = useState(ArtworkViewState.Metaplex);
  const breakpointColumnsObj = {
    default: 4,
    1100: 3,
    700: 2,
    500: 1,
  };

  const items =
    activeKey === ArtworkViewState.Owned
      ? ownedMetadata.map(m => m.metadata)
      : activeKey === ArtworkViewState.Created
      ? createdMetadata
      : metadata;

  useEffect(() => {
    if (connected) {
      setActiveKey(ArtworkViewState.Owned);
    } else {
      setActiveKey(ArtworkViewState.Metaplex);
    }
  }, [connected, setActiveKey]);

  const artworkGrid = (
    <Masonry
      breakpointCols={breakpointColumnsObj}
      className="my-masonry-grid"
      columnClassName="my-masonry-grid_column"
    >
      {!isLoading
        ? items.map((m, idx) => {
            const id = m.pubkey;
            //exclude all prints from display
            if (!prints.includes(m.pubkey)) {
              return (
                <Link to={`/art/${id}`} key={idx}>
                  <ArtCard
                    key={id}
                    pubkey={m.pubkey}
                    preview={false}
                    height={250}
                    width={250}
                  />
                </Link>
              );
            }
          })
        : [...Array(10)].map((_, idx) => <CardLoader key={idx} />)}
    </Masonry>
  );

  return (
    <Layout style={{ margin: 0, marginTop: 30 }}>
      <Content
        style={{ display: 'flex', flexWrap: 'wrap', objectFit: 'contain' }}
      >
        <Col style={{ width: '100%', marginTop: 10 }}>
          <Row>
            <Tabs
              activeKey={activeKey}
              onTabClick={key => setActiveKey(key as ArtworkViewState)}
            >
              <TabPane
                tab={<span className="tab-title">All</span>}
                key={ArtworkViewState.Metaplex}
              >
                {artworkGrid}
              </TabPane>
              {connected && (
                <TabPane
                  tab={<span className="tab-title">Owned</span>}
                  key={ArtworkViewState.Owned}
                >
                  {artworkGrid}
                </TabPane>
              )}
              {connected && (
                <TabPane
                  tab={<span className="tab-title">Created</span>}
                  key={ArtworkViewState.Created}
                >
                  {artworkGrid}
                </TabPane>
              )}
            </Tabs>
          </Row>
        </Col>
      </Content>
    </Layout>
  );
};
