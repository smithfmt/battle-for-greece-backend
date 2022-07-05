import { CardType, SquareType } from "./backend-types";

export const compare = (arr1:any[], arr2:any[]) => {
    return arr1.every((item, index) => {return item===arr2[index]});
};

export const findAdjacentCard = (cards:{card:CardType, square:SquareType}[], square:SquareType, dir:number) => {
    let testSquare = [...square];
    switch (dir) {
        case 0:
            testSquare[1]++;
            break;
        case 1:
            testSquare[0]++;
            break;
        case 2:
            testSquare[1]--;
            break;
        case 3:
            testSquare[0]--;
            break;
        default:
            break;
    };
    return cards.filter(card => {return compare(card.square, testSquare)})[0];
};

export const mapConnection = (index:number) => {
    let res = index+2;
    if (res>3) {res = res-4};
    return res;
};