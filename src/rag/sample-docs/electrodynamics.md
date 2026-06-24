# 电动力学样例资料

## 静电边值问题

静电边值问题需要同时给出区域、方程和边界条件。真空中电势满足 Poisson 方程

$$
\nabla^2\varphi=-\rho/\varepsilon_0
$$

无源区域满足 Laplace 方程。导体表面通常是等势面，介质界面处电势连续，法向电位移的跃变由自由面电荷决定。

## 镜像法

镜像法用求解区域外的虚设电荷构造满足导体边界条件的电势。镜像电荷不是实际电荷，方法成立的依据是静电唯一性定理。使用镜像法时必须验证边界条件和无穷远条件。

## 电磁势与规范

电磁场可由标势和矢势表示：

$$
\boldsymbol B=\nabla\times\boldsymbol A,\qquad
\boldsymbol E=-\nabla\varphi-\frac{\partial \boldsymbol A}{\partial t}
$$

规范变换不改变电场和磁场。Lorenz 规范便于保持相对论协变形式，Coulomb 规范常用于区分横场和纵场。
