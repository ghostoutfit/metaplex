import React, { useState, Component, SetStateAction } from 'react';
import {
  Row,
  Col,
  Divider,
  Layout,
  Tag,
  Button,
  Skeleton,
  Form,
  Input,
  Select,
  List,
  Card,
} from 'antd';
import { useParams } from 'react-router-dom';
import { useArt, useExtendedArt } from '../../hooks';
import { ArtContent } from '../../components/ArtContent';
import { shortenAddress, useConnection } from '@oyster/common';
import { useWallet } from '@solana/wallet-adapter-react';
import { MetaAvatar } from '../../components/MetaAvatar';
import { sendSignMetadata } from '../../actions/sendSignMetadata';
import { ViewOn } from '../../components/ViewOn';
import { ArtType } from '../../types';
import { ArtMinting } from '../../components/ArtMinting';
import Arweave from 'arweave';
import { ArtistCard } from '../../components/ArtistCard';

const { Content } = Layout;

export const ArtView = () => {
  const { id } = useParams<{ id: string }>();
  const wallet = useWallet();
  const [remountArtMinting, setRemountArtMinting] = useState(0);

  const connection = useConnection();
  const art = useArt(id);
  let badge = '';
  if (art.type === ArtType.NFT) {
    badge = 'Unique';
  } else if (art.type === ArtType.Master) {
    if (typeof art.maxSupply != 'undefined') {
      badge = `Master: Max ${art.maxSupply} Prints`;
    } else {
      badge = `Master: ∞ Prints`;
    }
  } else if (art.type === ArtType.Print) {
    badge = `${art.edition} of Max Supply`;
  }
  const { ref, data } = useExtendedArt(id);

  // const { userAccounts } = useUserAccounts();

  // const accountByMint = userAccounts.reduce((prev, acc) => {
  //   prev.set(acc.info.mint.toBase58(), acc);
  //   return prev;
  // }, new Map<string, TokenAccount>());

  const description = data?.description;
  const attributes = data?.attributes;

  const pubkey = wallet?.publicKey?.toBase58() || '';

  const tag = (
    <div className="info-header">
      <Tag color="blue">UNVERIFIED</Tag>
    </div>
  );

  const unverified = (
    <>
      {tag}
      <div style={{ fontSize: 12 }}>
        <i>
          This artwork is still missing verification from{' '}
          {art.creators?.filter(c => !c.verified).length} contributors before it
          can be considered verified and sellable on the platform.
        </i>
      </div>
      <br />
    </>
  );

  const arweave = Arweave.init({
    host: 'arweave.net',
  });

  //This is used down at the bottom for the dropdown menu value.
  const { Option } = Select;
  const [loreUser, setLoreUser] = useState('');
  function handleChange(value: string) {
    console.log(`selected ${value}`);
    setLoreUser(value);
  }

  const onFinish = loreSubmit => {
    console.log(loreSubmit.itemLore);
    submitLore(loreSubmit.itemLore);
  };

  const titleString = art.title.replace(/\s+/g, '');
  const loreUserString = loreUser.replace(/\s+/g, '');

  async function submitLore(itemLore: any) {
    await window.arweaveWallet.connect(
      [`ACCESS_ADDRESS`, `SIGN_TRANSACTION`, `SIGNATURE`],
      {
        name: 'ItemLore',
        logo: 'https://magicitems.org/img/ghosty.gif',
      },
    );

    console.log('ArtTitle Tag: ' + titleString);
    console.log('User Tag: ' + loreUserString);
    console.log('Print Tag: ' + art.edition);

    let key = await arweave.wallets.generate();

    // Plain text submission only
    let transactionA = await arweave.createTransaction(
      {
        data: Buffer.from(itemLore, 'utf8'),
      },
      key,
    );

    transactionA.addTag('Content-Type', 'text/html');
    transactionA.addTag('App-Name', 'ItemLore');
    transactionA.addTag('Item-Name', titleString);
    if (art.type === ArtType.Print) {
      transactionA.addTag('Print-Number', `${art.edition}`);
    } else {
      transactionA.addTag('Print-Number', '0');
    }
    transactionA.addTag('User-Name', loreUserString);

    await arweave.transactions.sign(transactionA);

    let uploader = await arweave.transactions.getUploader(transactionA);

    while (!uploader.isComplete) {
      await uploader.uploadChunk();
      console.log(
        `${uploader.pctComplete}% complete, ${uploader.uploadedChunks}/${uploader.totalChunks}`,
      );
    }
  }

  const query = {
    query: `query {
            transactions(
                tags: [
                    {
                        name: "App-Name",
                        values: ["ItemLore"]
                    },
                    {
                      name: "Item-Name",
                      values: ["${titleString}"]
                  }
                ]
            ) {
                edges {
                    node {
                        id
                        owner {
                          address
                        }
                      tags{
                        name
                        value
                      }
                      
                    }
                }
            }
        }`,
  };

  const requestOptions = {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(query),
  };

  //Make an array of stories through Arweave API
  async function fetchStories() {
    const res1 = await fetch('https://arweave.net/graphql', requestOptions);
    const queryList = await res1.clone().json();
    //console.log(queryList);
    const txs = queryList.data.transactions.edges;
    const txArray = new Array();
    for (let n = 0; n < txs.length; n++) {
      const tx = txs[n];
      const arrayid = n;
      const address = tx.node.owner.address;
      const userName = 'User: ' + tx.node.tags[4].value + ', ';
      const print = ' Print #' + tx.node.tags[3].value;
      const txid = tx.node.id;
      const txstory = await arweave.transactions
        .getData(tx.node.id, { decode: true, string: true })
        .then(txstory => {
          console.log(txstory);
          let newEntry = { arrayid, address, userName, print, txid, txstory };
          txArray.push(newEntry);
          //console.log(txArray);
        });
    }
    return txArray;
  }

  //useState Hook to display lore
  const [lores, setLores] = useState([
    { address: '', arrayid: 0, userName: '', print: '', txid: '', txstory: '' },
  ]);

  async function showStories() {
    let txArray: any[] = await fetchStories();
    setLores(txArray);
  }

  //Only prints show item lore entry.
  if (art.type === ArtType.Print) {
    return (
      <Content>
        <Col>
          <Row ref={ref}>
            <Col
              xs={{ span: 24 }}
              md={{ span: 12 }}
              style={{ padding: '30px' }}
            >
              <ArtContent
                style={{ width: '300px', height: '300px', margin: '0 auto' }}
                height={300}
                width={300}
                className="artwork-image"
                pubkey={id}
                active={true}
                allowMeshRender={true}
              />
            </Col>
            {/* <Divider /> */}
            <Col
              xs={{ span: 24 }}
              md={{ span: 12 }}
              style={{ textAlign: 'left', fontSize: '1.4rem' }}
            >
              <Row>
                <div style={{ fontWeight: 700, fontSize: '4rem' }}>
                  {art.title || <Skeleton paragraph={{ rows: 0 }} />}
                </div>
              </Row>
              <Row>
                <Col span={6}>
                  <h6>Royalties</h6>
                  <div className="royalties">
                    {((art.seller_fee_basis_points || 0) / 100).toFixed(2)}%
                  </div>
                </Col>
                <Col span={12}>
                  <ViewOn id={id} />
                </Col>
              </Row>
              <Row>
                <Col>
                  <h6 style={{ marginTop: 5 }}>Created By</h6>
                  <div className="creators">
                    {(art.creators || []).map((creator, idx) => {
                      return (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            marginBottom: 5,
                          }}
                        >
                          <MetaAvatar creators={[creator]} size={64} />
                          <div>
                            <span className="creator-name">
                              {creator.name ||
                                shortenAddress(creator.address || '')}
                            </span>
                            <div style={{ marginLeft: 10 }}>
                              {!creator.verified &&
                                (creator.address === pubkey ? (
                                  <Button
                                    onClick={async () => {
                                      try {
                                        await sendSignMetadata(
                                          connection,
                                          wallet,
                                          id,
                                        );
                                      } catch (e) {
                                        console.error(e);
                                        return false;
                                      }
                                      return true;
                                    }}
                                  >
                                    Approve
                                  </Button>
                                ) : (
                                  tag
                                ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Col>
              </Row>
              <Row>
                <Col>
                  <h6 style={{ marginTop: 5 }}>Edition</h6>
                  <div className="art-edition">{badge}</div>
                </Col>
              </Row>

              {/* <Button
                  onClick={async () => {
                    if(!art.mint) {
                      return;
                    }
                    const mint = new PublicKey(art.mint);

                    const account = accountByMint.get(art.mint);
                    if(!account) {
                      return;
                    }

                    const owner = wallet.publicKey;

                    if(!owner) {
                      return;
                    }
                    const instructions: any[] = [];
                    await updateMetadata(undefined, undefined, true, mint, owner, instructions)

                    sendTransaction(connection, wallet, instructions, [], true);
                  }}
                >
                  Mark as Sold
                </Button> */}

              {/* TODO: Add conversion of MasterEditionV1 to MasterEditionV2 */}
              <ArtMinting
                id={id}
                key={remountArtMinting}
                onMint={async () =>
                  await setRemountArtMinting(prev => prev + 1)
                }
              />
            </Col>
            <Col span="24">
              <Divider />
              {art.creators?.find(c => !c.verified) && unverified}
              <br />
              <div className="info-header">[• About the Item •]</div>
              <div className="info-content">{description}</div>
              <br />
              {/*
              TODO: add info about artist


            <div className="info-header">About the Creator</div>
            <div className="info-content">{art.about}</div> */}
            </Col>
            <Col span="24">
              {attributes && (
                <>
                  <Divider />
                  <br />
                  <div className="info-header">Attributes</div>
                  <List size="large" grid={{ column: 4 }}>
                    {attributes.map(attribute => (
                      <List.Item>
                        <Card title={attribute.trait_type}>
                          {attribute.value}
                        </Card>
                      </List.Item>
                    ))}
                  </List>
                </>
              )}
            </Col>
            <Col span="24">
              <Divider />
              {art.creators?.find(c => !c.verified) && unverified}
              <br />
              <div className="info-header">[• Item Lore •]</div>
              <h1>Select your User Name:</h1>
              <Form onFinish={onFinish}>
                <Form.Item>
                  <Select
                    defaultValue="Select Your User Name:"
                    style={{ width: 500 }}
                    onChange={handleChange}
                  >
                    <Option value="Ghost Outfit">Ghost Outfit</Option>
                    <Option value="Momo">Momo</Option>
                    <Option value="A-Mad-Hollow">A-Mad-Hollow</Option>
                    <Option value="AstroZombie">AstroZombie</Option>
                    <Option value="Badler">Badler</Option>
                    <Option value="BenJarWar">BenJarWar</Option>
                    <Option value="Rudoks-Tavern">Rudoks-Tavern</Option>
                  </Select>
                </Form.Item>
                <div>
                  <h1>ItemLore Arweave Tags:</h1>
                  <p>
                    Title: {titleString} / UserName: {loreUserString} / Print:{' '}
                    {art.edition}
                  </p>
                </div>
                <Form.Item name="itemLore">
                  <Input.TextArea placeholder="Tell a story..."></Input.TextArea>
                </Form.Item>
                <Form.Item>
                  <Button block type="primary" htmlType="submit">
                    Submit ItemLore
                  </Button>
                </Form.Item>
              </Form>
              <br />
              <Button block type="default" onClick={showStories}>
                Show ItemLore
              </Button>
              <br></br>
              <br></br>
              <div className="App">
                <ul>
                  {/*map over the id array*/}
                  {lores.map(lore => (
                    <div key={lore.arrayid}>
                      <h1>
                        <strong>
                          {lore.userName} {lore.print}
                        </strong>
                      </h1>
                      <h1>{lore.txstory}</h1>
                      <br></br>
                      <Divider />
                      <br></br>
                    </div>
                  ))}
                </ul>
              </div>
            </Col>
          </Row>
        </Col>
      </Content>
    );
  } else {
    return (
      <Content>
        <Col>
          <Row ref={ref}>
            <Col
              xs={{ span: 24 }}
              md={{ span: 12 }}
              style={{ padding: '30px' }}
            >
              <ArtContent
                style={{ width: '300px', height: '300px', margin: '0 auto' }}
                height={300}
                width={300}
                className="artwork-image"
                pubkey={id}
                active={true}
                allowMeshRender={true}
              />
            </Col>
            {/* <Divider /> */}
            <Col
              xs={{ span: 24 }}
              md={{ span: 12 }}
              style={{ textAlign: 'left', fontSize: '1.4rem' }}
            >
              <Row>
                <div style={{ fontWeight: 700, fontSize: '4rem' }}>
                  {art.title || <Skeleton paragraph={{ rows: 0 }} />}
                </div>
              </Row>
              <Row>
                <Col span={6}>
                  <h6>Royalties</h6>
                  <div className="royalties">
                    {((art.seller_fee_basis_points || 0) / 100).toFixed(2)}%
                  </div>
                </Col>
                <Col span={12}>
                  <ViewOn id={id} />
                </Col>
              </Row>
              <Row>
                <Col>
                  <h6 style={{ marginTop: 5 }}>Created By</h6>
                  <div className="creators">
                    {(art.creators || []).map((creator, idx) => {
                      return (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            marginBottom: 5,
                          }}
                        >
                          <MetaAvatar creators={[creator]} size={64} />
                          <div>
                            <span className="creator-name">
                              {creator.name ||
                                shortenAddress(creator.address || '')}
                            </span>
                            <div style={{ marginLeft: 10 }}>
                              {!creator.verified &&
                                (creator.address === pubkey ? (
                                  <Button
                                    onClick={async () => {
                                      try {
                                        await sendSignMetadata(
                                          connection,
                                          wallet,
                                          id,
                                        );
                                      } catch (e) {
                                        console.error(e);
                                        return false;
                                      }
                                      return true;
                                    }}
                                  >
                                    Approve
                                  </Button>
                                ) : (
                                  tag
                                ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Col>
              </Row>
              <Row>
                <Col>
                  <h6 style={{ marginTop: 5 }}>Edition</h6>
                  <div className="art-edition">{badge}</div>
                </Col>
              </Row>

              {/* <Button
                    onClick={async () => {
                      if(!art.mint) {
                        return;
                      }
                      const mint = new PublicKey(art.mint);
  
                      const account = accountByMint.get(art.mint);
                      if(!account) {
                        return;
                      }
  
                      const owner = wallet.publicKey;
  
                      if(!owner) {
                        return;
                      }
                      const instructions: any[] = [];
                      await updateMetadata(undefined, undefined, true, mint, owner, instructions)
  
                      sendTransaction(connection, wallet, instructions, [], true);
                    }}
                  >
                    Mark as Sold
                  </Button> */}

              {/* TODO: Add conversion of MasterEditionV1 to MasterEditionV2 */}
              <ArtMinting
                id={id}
                key={remountArtMinting}
                onMint={async () =>
                  await setRemountArtMinting(prev => prev + 1)
                }
              />
            </Col>
            <Col span="24">
              <Divider />
              {art.creators?.find(c => !c.verified) && unverified}
              <br />
              <div className="info-header">[• About the Item •]</div>
              <div className="info-content">{description}</div>
              <br />
              {/*
                TODO: add info about artist
  
  
              <div className="info-header">About the Creator</div>
              <div className="info-content">{art.about}</div> */}
            </Col>
            <Col span="24">
              {attributes && (
                <>
                  <Divider />
                  <br />
                  <div className="info-header">Attributes</div>
                  <List size="large" grid={{ column: 4 }}>
                    {attributes.map(attribute => (
                      <List.Item>
                        <Card title={attribute.trait_type}>
                          {attribute.value}
                        </Card>
                      </List.Item>
                    ))}
                  </List>
                </>
              )}
            </Col>
            <Col span="24">
              <Divider />
              {art.creators?.find(c => !c.verified) && unverified}
              <br />
              <div className="info-header">[• Item Lore •]</div>
              <br />
              <Button block type="default" onClick={showStories}>
                Show ItemLore
              </Button>
              <br></br>
              <br></br>
              <div className="App">
                <ul>
                  {/*map over the id array*/}
                  {lores.map(lore => (
                    <div key={lore.arrayid}>
                      <h1>
                        <strong>
                          {lore.userName} {lore.print}
                        </strong>
                      </h1>
                      <h1>{lore.txstory}</h1>
                      <br></br>
                      <hr></hr>
                      <br></br>
                    </div>
                  ))}
                </ul>
              </div>
            </Col>
          </Row>
        </Col>
      </Content>
    );
  }
};
