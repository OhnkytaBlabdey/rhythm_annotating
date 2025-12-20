export interface note {
  noBeat: boolean;
}
export interface noBeatNote extends note {
  val: number; //相对于上一个note或小节线0时刻的时间差
}
export interface beatNote extends note {
  num: number; //分子。第几根线
  denom: number; //分度值。n等分1拍
}
