/* eslint-disable @next/next/no-img-element */
"use client";
import { Suspense, useContext, useEffect, useMemo, useState } from "react";
import { NextPage } from "next";
import { useSearchParams } from "next/navigation";
import { useAnchorWallet, useWallet } from "@solana/wallet-adapter-react";

import { BiSearch } from "react-icons/bi";

import MainPageLayout from "@/components/Layout";
import TabsTip from "@/components/TabsTip";
import CollectionItemSkeleton from "@/components/CollectionItemSkeleton";
import NFTCard from "@/components/NFTCard";
import MyItemDetail from "@/components/MyItemDetail";
import ActivityFilterSelect from "@/components/ActivityFilterSelect";
import OfferFilterSelect from "@/components/OfferFilterSelect";
import MobileItemMultiSelectBar from "@/components/ItemMultiSelectBar/MobileItemMultiSelectBar";
import MobileTabsTip from "@/components/TabsTip/MobileTabsTip";
import ItemMultiSelectbar from "@/components/ItemMultiSelectBar";
import ActivityTable from "@/components/ActivityTable";
import OfferTable from "@/components/OfferTable";
import { errorAlert, successAlert } from "@/components/ToastGroup";
import MyNFTFilterSelect from "@/components/MyNFTFilterSelect";
import MobileMyItemDetail from "@/components/MyItemDetail/MobileMyItemDetail";

import { myItemFilterOptions } from "@/data/selectTabData";

import { ActivityDataType, OfferDataType, OwnNFTDataType } from "@/types/types";

import { LoadingContext } from "@/contexts/LoadingContext";
import { NFTDataContext } from "@/contexts/NFTDataContext";
import {
  cancelOfferApi,
  getAllActivitiesByMakerApi,
  getAllOffersByMakerApi,
} from "@/utils/api";
import { cancelOffer } from "@/utils/contractScript";
import { useWindowSize } from "@/hooks/useWindowSize";

const MyItem: NextPage = () => {
  const param = useSearchParams();
  const search = param.get("activeTab") || "items";
  const showQuery = useMemo(
    () => param.getAll("item") || ["unlisted"],
    [param]
  );
  const { height } = useWindowSize();

  const wallet = useAnchorWallet();
  const { publicKey, connected } = useWallet();
  const { ownNFTs, getOwnNFTsState, ownListedNFTs } =
    useContext(NFTDataContext);
  const [showNFTs, setShowNFTs] = useState<OwnNFTDataType[]>([]);
  const [filterLoading, setFilterLoading] = useState(true);
  const [nameSearch, setNameSearch] = useState("");
  const [offerData, setOfferData] = useState<OfferDataType[]>([]);
  const [filterOfferData, setFilterOfferData] = useState<OfferDataType[]>([]);
  const [offerShowType, setOfferShowType] = useState(0);
  const [activityData, setActivityData] = useState<ActivityDataType[]>([]);
  const [filteredActivityData, setFilteredActivityData] = useState<
    ActivityDataType[]
  >([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedNFTs, setSelectedNFTs] = useState<OwnNFTDataType[]>([]);

  const { openFunctionLoading, closeFunctionLoading } =
    useContext(LoadingContext);

  const getAllOffersByMaker = async () => {
    try {
      const data = await getAllOffersByMakerApi(publicKey?.toBase58()!);

      if (data.length === 0) {
        setOfferData([]);
        return;
      }

      const filteredData = data.map(
        ({
          mintAddr,
          offerPrice,
          tokenId,
          imgUrl,
          seller,
          buyer,
          active,
        }: OfferDataType) => ({
          mintAddr,
          offerPrice,
          tokenId,
          imgUrl,
          seller,
          buyer,
          active,
        })
      );

      setOfferData(filteredData);
    } catch (error) {
      console.error("Error fetching data: ", error);
    }
  };

  const getActivityByMintAddr = async () => {
    try {
      const data = await getAllActivitiesByMakerApi(publicKey?.toBase58()!);
      setActivityData(data);
      // You can now use the fetched data (e.g., set it in a state)
    } catch (error) {
      console.error("Error fetching data: ", error);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      if (publicKey) {
        try {
          await getAllOffersByMaker();
          await getActivityByMintAddr();
        } catch (error) {
          console.error("Error fetching data: ", error);
        }
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicKey]);

  useEffect(() => {
    const updateShowNFTs = () => {
      if (showQuery[0] === "listed") {
        setShowNFTs(ownListedNFTs);
      } else {
        setShowNFTs(ownNFTs);
      }
    };

    updateShowNFTs();
    setFilterLoading(false);
  }, [showQuery, ownNFTs, ownListedNFTs]);

  useEffect(() => {
    if (ownListedNFTs.length === 0 || ownNFTs.length === 0) return;
    const filterNFTs = (nfts: any) =>
      nameSearch === ""
        ? nfts
        : nfts.filter(
            (item: { collectionName: string; tokenId: string }) =>
              item.collectionName.includes(nameSearch) ||
              item.tokenId.includes(nameSearch)
          );

    const nftsToShow = showQuery[0] === "listed" ? ownListedNFTs : ownNFTs;
    console.log("filterNFTs", filterNFTs(nftsToShow));
    setShowNFTs(filterNFTs(nftsToShow));
    setFilterLoading(false);
  }, [nameSearch, showQuery, ownListedNFTs, ownNFTs]);

  // Filter the Activity Table
  const addTag = (tag: string) => {
    if (!selectedTags.includes(tag)) {
      setSelectedTags([...selectedTags, tag]);
    }
  };
  const removeTag = (tag: string) => {
    setSelectedTags(selectedTags.filter((t) => t !== tag));
  };

  useEffect(() => {
    const filtered = activityData.filter((item) => {
      if (selectedTags.length === 0) return true;
      if (selectedTags.includes("List") && item.txType === 0) return true;
      if (selectedTags.includes("Delist") && item.txType === 1) return true;
      if (selectedTags.includes("Sale") && item.txType === 2) return true;
      return false;
    });

    setFilteredActivityData(filtered);
  }, [selectedTags, activityData]);

  useEffect(() => {
    if (!publicKey || !offerData) return;
    const filtered =
      offerShowType === 0
        ? offerData.filter((item) => item.buyer === publicKey?.toBase58())
        : offerData.filter((item) => item.seller === publicKey?.toBase58());

    setFilterOfferData(filtered);
  }, [publicKey, offerShowType, offerData]);

  const handleCancelOffer = async (mintAddr: string) => {
    if (wallet && mintAddr !== undefined) {
      try {
        openFunctionLoading();
        const filterOfferData = offerData.filter(
          (data) => data.mintAddr === mintAddr
        );
        const tx = await cancelOffer(wallet, filterOfferData);
        if (tx) {
          const result = await cancelOfferApi(
            tx.mintAddr,
            tx.offerData,
            tx.transaction
          );
          if (result.type === "success") {
            closeFunctionLoading();
            successAlert("Success");
            await getAllOffersByMaker();
          } else {
            closeFunctionLoading();
            errorAlert("Something went wrong.");
          }
        } else {
          closeFunctionLoading();
          errorAlert("Something went wrong.");
        }
      } catch (e) {
        console.log("err =>", e);
        closeFunctionLoading();
        errorAlert("Something went wrong.");
      }
    }
  };

  const toggleNFTSelection = (nft: OwnNFTDataType) => {
    setSelectedNFTs((prevSelectedNFTs) => {
      if (prevSelectedNFTs.find((item) => item.mintAddr === nft.mintAddr)) {
        return prevSelectedNFTs.filter(
          (item) => item.mintAddr !== nft.mintAddr
        );
      } else {
        return [...prevSelectedNFTs, nft];
      }
    });
  };

  const rangeSelection = (length: number) => {
    const data = Array.from({ length }, (_, i) => showNFTs[i]);
    setSelectedNFTs(data);
  };

  return (
    <MainPageLayout>
      <div
        className={`w-full flex items-start justify-start flex-row ${
          !connected && " hidden"
        }`}
      >
        <div className="w-full flex items-start justify-start mt-5 md:gap-4 gap-2 flex-col px-2">
          <MyItemDetail />
          <MobileMyItemDetail collectionData={undefined} />
          <TabsTip setSelectedNFTs={() => setSelectedNFTs([])} />
          <div className="w-full flex items-center justify-start flex-row gap-3">
            <div
              className={`flex items-center justify-center gap-2 w-full ${
                (search === "activity" || search === "offers") && "hidden"
              }`}
            >
              {/* <ListNFTFilterSelect /> */}
              <div
                className={`w-full flex items-center justify-start px-2 rounded-md border border-customborder `}
              >
                <BiSearch color="white" />
                <input
                  placeholder="Search items"
                  className="outline-none bg-transparent w-full text-white py-1 px-1 font-thin placeholder:text-gray-600"
                  onChange={(e) => setNameSearch(e.target.value)}
                />
              </div>
            </div>
            <div
              className={`${
                (search === "activity" || search === "offers") && "hidden"
              } flex gap-2`}
            >
              {/* <CollectionFilterSelect
                options={collectionFilterOptions}
                filterType={"price"}
              /> */}
              <MyNFTFilterSelect
                setSelectItem={() => setSelectedNFTs([])}
                options={myItemFilterOptions}
                filterType={"item"}
              />
            </div>

            <div className={`${search !== "offers" && "hidden"} `}>
              <OfferFilterSelect
                setOfferShowType={(index: number) => setOfferShowType(index)}
                offerShowType={offerShowType}
              />
            </div>
            <div className={`${search !== "activity" && "hidden"}`}>
              <ActivityFilterSelect
                selectedTags={selectedTags}
                addTag={(tag) => addTag(tag)}
                removeTag={(tag) => removeTag(tag)}
                setSelectedTags={() => setSelectedTags([])}
              />
            </div>
          </div>
          <div
            className={`${
              (search === "activity" || search === "offers") && "hidden"
            } w-full`}
          >
            <ItemMultiSelectbar
              nftLength={showNFTs.length}
              rangeSelection={(length: number) => rangeSelection(length)}
              setSelectedNFTs={() => setSelectedNFTs([])}
              selectedNFTLists={selectedNFTs}
              toggleSelection={(item: OwnNFTDataType) =>
                toggleNFTSelection(item)
              }
              functionState={
                showQuery.toString() === "" ||
                showQuery.toString() === "unlisted"
                  ? "list"
                  : "delist"
              }
            />
          </div>
          <div
            className={`w-full overflow-y-auto pb-14 md:pb-16`}
            style={{ maxHeight: height! * 0.68 + "px" }}
          >
            <div
              className={`relative ${
                search === "items" || search === null ? "block" : "hidden"
              }`}
            >
              <CollectionItemSkeleton loadingState={filterLoading} />
              <div
                className={`w-full grid grid-cols-2 md:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] md:gap-5 gap-3 ${
                  filterLoading && "hidden"
                }`}
              >
                {showNFTs?.map((item, index) => (
                  <NFTCard
                    imgUrl={item.imgUrl}
                    collectionName={item.collectionName}
                    tokenId={item.tokenId}
                    key={index}
                    mintAddr={item.mintAddr}
                    solPrice={item.solPrice}
                    state={item.solPrice === 0 ? "unlisted" : "listed"}
                    isSelected={
                      !!selectedNFTs.find(
                        (nft) => nft.mintAddr === item.mintAddr
                      )
                    }
                    toggleSelection={() => toggleNFTSelection(item)}
                  />
                ))}
              </div>
            </div>
            <div
              className={`${
                !filterLoading && showNFTs.length === 0 ? "flex" : "hidden"
              } items-center justify-center ${
                (search === "activity" || search === "offers") && "hidden"
              }`}
            >
              <p className="text-gray-400 text-center">
                Nothing to show
                <br />
                Items you own will appear here in your Portfolio
              </p>
            </div>
            <div
              className={`w-full flex items-center justify-center ${
                search === "offers" ? "block" : "hidden"
              }`}
            >
              <OfferTable
                data={filterOfferData}
                handleCancelOffer={(mintAddr: string) =>
                  handleCancelOffer(mintAddr)
                }
                canCancel={true}
              />
            </div>
            <div
              className={`w-full flex items-center justify-center ${
                search === "activity" ? "block" : "hidden"
              }`}
            >
              <ActivityTable data={filteredActivityData} />
            </div>
          </div>
        </div>
        <MobileItemMultiSelectBar
          nftLength={showNFTs.length}
          rangeSelection={(length: number) => rangeSelection(length)}
          setSelectedNFTs={() => setSelectedNFTs([])}
          selectedNFTLists={selectedNFTs}
          toggleSelection={(item: OwnNFTDataType) => toggleNFTSelection(item)}
          functionState={
            showQuery.toString() === "" || showQuery.toString() === "unlisted"
              ? "list"
              : "delist"
          }
        />
        <MobileTabsTip setSelectedNFTs={() => setSelectedNFTs([])} />
      </div>
      <div
        className={`${
          !publicKey ? "flex" : "hidden"
        } items-center justify-center min-h-[80vh] w-full`}
      >
        <p className="text-gray-400 text-center">
          Connect wallet to see your profile page
        </p>
      </div>
    </MainPageLayout>
  );
};

export default function MyItemPage() {
  return (
    <Suspense>
      <MyItem />
    </Suspense>
  );
}
