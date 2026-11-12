// flair-metal-hash: aa9cffc3
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

// Implementation of the GLSL mod() function, which is slightly different than Metal fmod()
template<typename Tx, typename Ty>
inline Tx mod(Tx x, Ty y)
{
    return x - y * floor(x / y);
}

struct FlairUniforms
{
    packed_float3 iResolution;
    float iTime;
    float iTimeDelta;
    int iFrame;
    float iBeat;
    float flair_flipY;
    float4 iMouse;
    float4 iPointer;
    float4 iClicks[8];
    float4 iTrail[32];
    float4 iAudio;
    float4 iSpectrum[16];
    float4 iScroll;
    float3 uBuilding;
    float3 uAccent;
    float3 uGround;
    float3 uRoad;
    packed_float3 uWindow;
    float uDayLength;
    float uTimeOfDay;
    float uHeight;
    float uRise;
    float uZoom;
    float uPan;
};

struct flair_isometric_city_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 sunAt(constant FlairUniforms& _148)
{
    float phase = fract(_148.uTimeOfDay + (_148.iTime / _148.uDayLength)) * 6.28318023681640625;
    float3 dir = fast::normalize(float3(cos(phase) * 0.800000011920928955078125, sin(phase), 0.449999988079071044921875));
    return float4(dir, smoothstep(-0.2199999988079071044921875, 0.20000000298023223876953125, dir.y));
}

static inline __attribute__((always_inline))
bool isRoad(thread const float2& c)
{
    bool _71 = mod(c.x, 4.0) < 0.5;
    bool _79;
    if (!_71)
    {
        _79 = mod(c.y, 4.0) < 0.5;
    }
    else
    {
        _79 = _71;
    }
    return _79;
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float2 building(thread const float2& c, constant FlairUniforms& _148)
{
    float2 param = c;
    if (isRoad(param))
    {
        return float2(0.0);
    }
    float2 param_1 = c;
    float h = hash12(param_1);
    float2 param_2 = c + float2(17.299999237060546875);
    float k = hash12(param_2);
    if (k < 0.07999999821186065673828125)
    {
        return float2(0.0, k);
    }
    float district = 0.5 + ((0.5 * sin((c.x * 0.12999999523162841796875) + 1.2999999523162841796875)) * sin((c.y * 0.10999999940395355224609375) + 0.4000000059604644775390625));
    float height = ((0.60000002384185791015625 + (0.60000002384185791015625 * h)) + ((4.80000019073486328125 * powr(h, 4.0)) * district)) * _148.uHeight;
    float2 param_3 = c + float2(5.099999904632568359375);
    float start = (hash12(param_3) * _148.uRise) * 0.75;
    float _171;
    if (_148.uRise <= 0.0)
    {
        _171 = 1.0;
    }
    else
    {
        _171 = smoothstep(start, (start + (_148.uRise * 0.25)) + 0.00999999977648258209228515625, _148.iTime);
    }
    float grow = _171;
    return float2(fast::min(height, 7.0) * grow, k);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _148)
{
    float2 p = (fragCoord - (float2(_148.iResolution[0], _148.iResolution[1]) * 0.5)) / float2(_148.iResolution[1u]);
    float3 d = float3(-0.61171519756317138671875, -0.501606464385986328125, -0.61171519756317138671875);
    float3 rt = fast::normalize(cross(d, float3(0.0, 1.0, 0.0)));
    float3 up = cross(rt, d);
    float3 target = ((float3(1.0, 0.0, 0.300000011920928955078125) * _148.iTime) * _148.uPan) + float3(0.5, 0.0, 0.5);
    float3 o = (target + ((((rt * p.x) + (up * p.y)) * 10.0) / float3(_148.uZoom))) - (d * 40.0);
    float t = (7.0 - o.y) / d.y;
    float3 pos = o + (d * t);
    float2 cell = floor(pos.xz);
    float2 stepDir = sign(d.xz);
    float2 delta = abs(float2(1.0) / d.xz);
    float2 side = ((((stepDir * (cell - pos.xz)) + (stepDir * 0.5)) + float2(0.5)) * delta) + float2(t);
    float3 inv = float3(1.0) / d;
    float4 sun = sunAt(_148);
    float day = sun.w;
    float night = 1.0 - day;
    float3 ambient = mix(float3(0.2199999988079071044921875, 0.2599999904632568359375, 0.449999988079071044921875), float3(1.0), float3(day));
    float3 col = (_148.uGround * ambient) * 0.699999988079071044921875;
    float3 _471;
    float3 _479;
    float _528;
    float _564;
    float3 g_1;
    float _732;
    float _743;
    float _777;
    float3 _851;
    float _870;
    for (int i = 0; i < 48; i++)
    {
        float tExit = fast::min(side.x, side.y);
        float2 param = cell;
        float2 b = building(param, _148);
        if (b.x > 0.0)
        {
            float3 lo = float3(cell.x + 0.119999997317790985107421875, 0.0, cell.y + 0.119999997317790985107421875);
            float3 hi = float3(cell.x + 0.87999999523162841796875, b.x, cell.y + 0.87999999523162841796875);
            float3 t0 = (lo - o) * inv;
            float3 t1 = (hi - o) * inv;
            float3 tn = fast::min(t0, t1);
            float3 tf = fast::max(t0, t1);
            float tin = fast::max(fast::max(tn.x, tn.y), tn.z);
            float tout = fast::min(fast::min(tf.x, tf.y), tf.z);
            if ((tin < tout) && (tout > 0.0))
            {
                float3 hp = o + (d * tin);
                if (tin == tn.y)
                {
                    _471 = float3(0.0, 1.0, 0.0);
                }
                else
                {
                    if (tin == tn.x)
                    {
                        _479 = float3(-stepDir.x, 0.0, 0.0);
                    }
                    else
                    {
                        _479 = float3(0.0, 0.0, -stepDir.y);
                    }
                    _471 = _479;
                }
                float3 n = _471;
                float2 param_1 = cell + float2(2.0);
                float3 base = mix(_148.uBuilding, _148.uAccent, float3(step(0.7200000286102294921875, b.y))) * (0.85000002384185791015625 + (0.300000011920928955078125 * hash12(param_1)));
                float light = fast::max(dot(n, sun.xyz), 0.0) * day;
                if (n.y > 0.5)
                {
                    _528 = 1.0;
                }
                else
                {
                    _528 = (abs(n.x) > 0.5) ? 0.7799999713897705078125 : 0.62000000476837158203125;
                }
                float face = _528;
                float3 c = (base * face) * ((ambient * 0.550000011920928955078125) + ((float3(1.0, 0.949999988079071044921875, 0.85000002384185791015625) * light) * 0.60000002384185791015625));
                if (n.y < 0.5)
                {
                    if (abs(n.x) > 0.5)
                    {
                        _564 = hp.z;
                    }
                    else
                    {
                        _564 = hp.x;
                    }
                    float along = _564;
                    float2 g = float2(along * 4.0, hp.y * 3.2000000476837158203125);
                    float2 f = fract(g);
                    float pane = ((((step(0.25, f.x) * step(f.x, 0.75)) * step(0.300000011920928955078125, f.y)) * step(f.y, 0.7799999713897705078125)) * step(0.25, hp.y)) * step(hp.y, b.x - 0.1500000059604644775390625);
                    float2 param_2 = (floor(g) + (cell * 7.0)) + (n.xz * 3.0);
                    float on = step(hash12(param_2), (night * 0.75) - 0.0500000007450580596923828125);
                    float3 glass = mix((float3(0.3499999940395355224609375, 0.5, 0.64999997615814208984375) * ambient) * face, float3(_148.uWindow) * 1.60000002384185791015625, float3(on));
                    c = mix(c, glass, float3(pane));
                    c *= (0.699999988079071044921875 + (0.300000011920928955078125 * smoothstep(0.0, 1.2000000476837158203125, hp.y)));
                }
                else
                {
                    float2 r = abs(fract(hp.xz) - float2(0.5));
                    c *= (0.89999997615814208984375 + (0.100000001490116119384765625 * step(fast::max(r.x, r.y), 0.300000011920928955078125)));
                }
                col = c;
                break;
            }
        }
        float tg = (-o.y) / d.y;
        if (tg <= tExit)
        {
            float3 gp = o + (d * tg);
            float2 f_1 = fract(gp.xz);
            float2 param_3 = cell;
            if (isRoad(param_3))
            {
                g_1 = _148.uRoad;
                bool alongX = mod(cell.y, 4.0) < 0.5;
                bool _722 = mod(cell.x, 4.0) < 0.5;
                bool _729;
                if (_722)
                {
                    _729 = mod(cell.y, 4.0) < 0.5;
                }
                else
                {
                    _729 = _722;
                }
                bool junction = _729;
                if (alongX)
                {
                    _732 = f_1.y;
                }
                else
                {
                    _732 = f_1.x;
                }
                float across = _732;
                if (alongX)
                {
                    _743 = gp.x;
                }
                else
                {
                    _743 = gp.z;
                }
                float run = _743;
                float lane = (across < 0.5) ? 1.0 : (-1.0);
                g_1 = mix(g_1, float3(0.920000016689300537109375), float3((step(abs(across - 0.5), 0.0199999995529651641845703125) * step(0.5, fract(run * 2.0))) * (junction ? 0.0 : 1.0)));
                if (alongX)
                {
                    _777 = cell.y;
                }
                else
                {
                    _777 = cell.x;
                }
                float road = _777;
                float2 param_4 = float2(road, lane);
                float slot = ((run * 0.25) - ((_148.iTime * 0.3499999940395355224609375) * lane)) + hash12(param_4);
                float2 param_5 = float2(floor(slot), road + lane);
                float car = (step(abs((across - 0.5) + (lane * 0.2199999988079071044921875)), 0.10999999940395355224609375) * step(abs(fract(slot) - 0.5), 0.070000000298023223876953125)) * step(0.4000000059604644775390625, hash12(param_5));
                float2 param_6 = float2(floor(slot), road);
                float3 carCol = mix(float3(0.89999997615814208984375, 0.300000011920928955078125, 0.300000011920928955078125), float3(0.300000011920928955078125, 0.5, 0.89999997615814208984375), float3(hash12(param_6)));
                g_1 = mix(g_1, mix(carCol, float3(2.0, 1.7999999523162841796875, 1.2000000476837158203125), float3(night)), float3(car));
            }
            else
            {
                if (b.y < 0.07999999821186065673828125)
                {
                    _851 = _148.uGround * float3(0.800000011920928955078125, 1.0, 0.75);
                }
                else
                {
                    _851 = _148.uGround;
                }
                g_1 = _851;
                float2 q = abs(f_1 - float2(0.5));
                if (b.x > 0.0)
                {
                    _870 = mix(0.60000002384185791015625, 1.0, smoothstep(0.37999999523162841796875, 0.5, fast::max(q.x, q.y)));
                }
                else
                {
                    _870 = 1.0;
                }
                g_1 *= _870;
                float2 corner = q - float2(0.4199999868869781494140625);
                float lamp = (exp((-length(fast::max(corner, float2(0.0)))) * 18.0) * step(0.0, corner.x)) * step(0.0, corner.y);
                g_1 += (((float3(_148.uWindow) * lamp) * night) * 1.5);
            }
            col = g_1 * mix(ambient * 0.699999988079071044921875, ambient, float3(day));
            break;
        }
        if (side.x < side.y)
        {
            side.x += delta.x;
            cell.x += stepDir.x;
        }
        else
        {
            side.y += delta.y;
            cell.y += stepDir.y;
        }
    }
    col *= mix(float3(1.0), float3(1.14999997615814208984375, 0.85000002384185791015625, 0.699999988079071044921875), float3(smoothstep(0.3499999940395355224609375, 0.0, abs(sun.y)) * 0.60000002384185791015625));
    fragColor = float4(col, 1.0);
}

fragment flair_isometric_city_frag_out flair_isometric_city_frag(constant FlairUniforms& _148 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_isometric_city_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _988;
    if (_148.flair_flipY > 0.5)
    {
        _988 = _148.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _988 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _988);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _148);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

