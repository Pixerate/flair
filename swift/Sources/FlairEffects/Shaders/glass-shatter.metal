// flair-metal-hash: e428e87a
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
    packed_float3 uBackground;
    int uSpokes;
    float uGrowth;
    float uScale;
    float uGravity;
    float uSpin;
    float uRestore;
    uint uDemo;
    char _m21_pad[8];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
    float uBackgroundAlpha;
};

struct flair_glass_shatter_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _201)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_201.uBackdrop) * _201.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_201.uBackdropAlpha * (1.0 - s.w));
    return float4(colour / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), alpha);
}

static inline __attribute__((always_inline))
float3 testCard(thread const float2& uv)
{
    float3 sky = mix(float3(0.980000019073486328125, 0.62000000476837158203125, 0.4199999868869781494140625), float3(0.23999999463558197021484375, 0.319999992847442626953125, 0.7200000286102294921875), float3(uv.y));
    float sun = smoothstep(0.1599999964237213134765625, 0.1500000059604644775390625, length((uv - float2(0.64999997615814208984375, 0.579999983310699462890625)) * float2(1.60000002384185791015625, 1.0)));
    float hills = step(uv.y, (0.319999992847442626953125 + (0.0599999986588954925537109375 * sin(uv.x * 9.0))) + (0.039999999105930328369140625 * sin((uv.x * 23.0) + 1.0)));
    float3 col = mix(sky, float3(1.0, 0.920000016689300537109375, 0.699999988079071044921875), float3(sun));
    col = mix(col, float3(0.119999997317790985107421875, 0.2800000011920928955078125, 0.23999999463558197021484375) + float3(0.07999999821186065673828125 * sin(uv.x * 40.0)), float3(hills));
    float2 grid = abs(fract(uv * 8.0) - float2(0.5));
    col += float3(0.039999999105930328369140625 * step(0.4799999892711639404296875, fast::max(grid.x, grid.y)));
    return col;
}

static inline __attribute__((always_inline))
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _201)
{
    float4 _342;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _342 = overBackdrop(param, _201);
    }
    else
    {
        float2 param_1 = fract(uv);
        _342 = float4(testCard(param_1), 1.0);
    }
    return _342;
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float4 lastClick(constant FlairUniforms& _201)
{
    bool _367 = !(_201.uDemo != 0u);
    bool _375;
    if (!_367)
    {
        _375 = _201.iClicks[0].w > 0.5;
    }
    else
    {
        _375 = _367;
    }
    if (_375)
    {
        return _201.iClicks[0];
    }
    float k = floor(_201.iTime / 5.5);
    float2 param = float2((k * 1.37000000476837158203125) + 0.5, 3.7000000476837158203125);
    float2 h = hash22(param);
    return float4((float2(0.25) + (h * 0.5)) * float2(_201.iResolution[0], _201.iResolution[1]), (k * 5.5) + 0.4000000059604644775390625, 1.0);
}

static inline __attribute__((always_inline))
float2 ballistic(thread const float2& v, thread const float& k, thread const float& g, thread const float& t)
{
    float e = (1.0 - exp((-k) * t)) / k;
    return (v * e) - float2(0.0, (g / k) * (t - e));
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float release(thread const float& sid, thread const float& ring)
{
    float2 param = float2(sid, ring + 9.0);
    return (0.300000011920928955078125 + (0.1599999964237213134765625 * ring)) + (0.25 * hash12(param));
}

static inline __attribute__((always_inline))
float spoke(thread const float& i, constant FlairUniforms& _201)
{
    float n = float(_201.uSpokes);
    float2 param = float2(mod(i, n), 3.099999904632568359375);
    return ((i + (0.60000002384185791015625 * (hash12(param) - 0.5))) * 6.28318023681640625) / n;
}

static inline __attribute__((always_inline))
float2x2 rot(thread const float& a)
{
    float c = cos(a);
    float s = sin(a);
    return float2x2(float2(c, s), float2(-s, c));
}

static inline __attribute__((always_inline))
float ringAt(thread const float& s, thread const float& j, constant FlairUniforms& _201)
{
    float2 param = float2(s, j + 0.5);
    return (_201.uScale * powr(_201.uGrowth, j - 1.0)) * (0.85000002384185791015625 + (0.300000011920928955078125 * hash12(param)));
}

static inline __attribute__((always_inline))
float3 shardOf(thread const float2& q, constant FlairUniforms& _201)
{
    float n = float(_201.uSpokes);
    float a = precise::atan2(q.y, q.x);
    if (a < 0.0)
    {
        a += 6.28318023681640625;
    }
    float s = floor((a / 6.28318023681640625) * n);
    float param = s;
    if (a < spoke(param, _201))
    {
        s -= 1.0;
    }
    else
    {
        float param_1 = s + 1.0;
        if (a >= spoke(param_1, _201))
        {
            s += 1.0;
        }
    }
    float param_2 = s;
    float a0 = spoke(param_2, _201);
    float param_3 = s + 1.0;
    float a1 = spoke(param_3, _201);
    float mid = 0.5 * (a0 + a1);
    float d = dot(q, float2(cos(mid), sin(mid)));
    float sid = mod(s, n);
    float ring = 0.0;
    float inner = 0.0;
    float outer = 1000.0;
    for (int j = 1; j < 8; j++)
    {
        float param_4 = sid;
        float param_5 = float(j);
        float b = ringAt(param_4, param_5, _201);
        if (d < b)
        {
            outer = b;
            break;
        }
        ring = float(j);
        inner = b;
    }
    float edge = fast::min(outer - d, fast::min(abs((q.x * sin(a0)) - (q.y * cos(a0))), abs((q.x * sin(a1)) - (q.y * cos(a1)))));
    if (ring > 0.0)
    {
        edge = fast::min(edge, d - inner);
    }
    return float3(sid, ring, edge);
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _201, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 p = (fragCoord - (float2(_201.iResolution[0], _201.iResolution[1]) * 0.5)) / float2(_201.iResolution[1u]);
    float px = 1.0 / _201.iResolution[1u];
    float2 toUv = float2(_201.iResolution[1u]) / float2(_201.iResolution[0], _201.iResolution[1]);
    float2 param = (p * toUv) + float2(0.5);
    float4 intact = pictureRGBA(uImage, uImageSmplr, param, _201);
    float4 click = lastClick(_201);
    float _658;
    if (click.w > 0.5)
    {
        _658 = _201.iTime - click.z;
    }
    else
    {
        _658 = -1.0;
    }
    float age = _658;
    bool _670 = age < 0.0;
    bool _680;
    if (!_670)
    {
        _680 = age > (_201.uRestore + 1.0);
    }
    else
    {
        _680 = _670;
    }
    if (_680)
    {
        fragColor = intact;
        return;
    }
    float2 c = (click.xy - (float2(_201.iResolution[0], _201.iResolution[1]) * 0.5)) / float2(_201.iResolution[1u]);
    float2 q = p - c;
    float4 col = float4(_201.uBackground[0], _201.uBackground[1], _201.uBackground[2], 1.0);
    float best = 1000.0;
    float4 hit = float4(0.0);
    float2 hitCentre = float2(0.0);
    float n = float(_201.uSpokes);
    float spreadMax = tan(fast::min(5.026544094085693359375 / n, 1.5));
    float _768;
    float _780;
    float _796;
    float _812;
    float _1161;
    float _1180;
    float _1202;
    for (int j = 0; j < 8; j++)
    {
        float ring = float(j);
        float firstGo = 0.300000011920928955078125 + (0.1599999964237213134765625 * ring);
        float dtHi = age - firstGo;
        if ((dtHi <= 0.0) || (firstGo >= best))
        {
            break;
        }
        float dtLo = fast::max(dtHi - 0.25, 0.0);
        float span = _201.uScale * powr(_201.uGrowth, ring);
        if (j > 0)
        {
            _768 = span / _201.uGrowth;
        }
        else
        {
            _768 = 0.0;
        }
        float lo = _768;
        if (j > 0)
        {
            _780 = 0.425000011920928955078125 * (lo + span);
        }
        else
        {
            _780 = 0.56099998950958251953125 * span;
        }
        float rcLo = _780;
        if (j > 0)
        {
            _796 = 0.574999988079071044921875 * (lo + span);
        }
        else
        {
            _796 = 0.759000003337860107421875 * span;
        }
        float rcHi = _796;
        if (j > 0)
        {
            _812 = 0.5 * fast::max((1.14999997615814208984375 * span) - (0.85000002384185791015625 * lo), (1.14999997615814208984375 * lo) - (0.85000002384185791015625 * span));
        }
        else
        {
            _812 = rcHi;
        }
        float radial = _812;
        float reachMax = length(float2(radial, (1.14999997615814208984375 * span) * spreadMax)) + 0.0199999995529651641845703125;
        float rMin = ((rcLo + (((0.0500000007450580596923828125 * (1.0 - exp((-0.60000002384185791015625) * dtLo))) / 0.60000002384185791015625) / (1.0 + ring))) - reachMax) - 0.00999999977648258209228515625;
        float rMax = ((rcHi + (((0.20000000298023223876953125 * (1.0 - exp((-0.60000002384185791015625) * dtHi))) / 0.60000002384185791015625) / (1.0 + ring))) + reachMax) + 0.00999999977648258209228515625;
        float2 param_1 = float2(0.0, 0.07999999821186065673828125);
        float param_2 = 0.60000002384185791015625;
        float param_3 = _201.uGravity;
        float param_4 = dtLo;
        float yA = ballistic(param_1, param_2, param_3, param_4).y;
        float2 param_5 = float2(0.0, 0.07999999821186065673828125);
        float param_6 = 0.60000002384185791015625;
        float param_7 = _201.uGravity;
        float param_8 = dtHi;
        float yB = ballistic(param_5, param_6, param_7, param_8).y;
        float yLo = fast::min(yA, yB) - 0.0199999995529651641845703125;
        float yHi = fast::max(yA, yB) + 0.0199999995529651641845703125;
        float dNear = length(float2(q.x, q.y - fast::clamp(q.y, yLo, yHi)));
        float dFar = fast::max(length(q - float2(0.0, yLo)), length(q - float2(0.0, yHi)));
        if ((dFar < rMin) || (dNear > rMax))
        {
            continue;
        }
        float first = 0.0;
        float count = n;
        float slack = reachMax + 0.00999999977648258209228515625;
        if (dNear > slack)
        {
            float2 na = fast::normalize(q - float2(0.0, yLo));
            float2 nb = fast::normalize(q - float2(0.0, yHi));
            float w = (0.5 * acos(fast::clamp(dot(na, nb), -1.0, 1.0))) + asin(slack / dNear);
            float2 bisect = na + nb;
            float toward = precise::atan2(bisect.y, bisect.x) / (6.28318023681640625 / n);
            w /= (6.28318023681640625 / n);
            first = ceil((toward - w) - 0.800000011920928955078125);
            count = fast::min((floor((toward + w) - 0.20000000298023223876953125) - first) + 1.0, n);
        }
        for (int k = 0; k < 16; k++)
        {
            if (float(k) >= count)
            {
                break;
            }
            float sid = mod(first + float(k), n);
            float param_9 = sid;
            float param_10 = ring;
            float tr = release(param_9, param_10);
            float dt = age - tr;
            if ((dt <= 0.0) || (tr >= best))
            {
                continue;
            }
            float e = (1.0 - exp((-0.60000002384185791015625) * dt)) / 0.60000002384185791015625;
            float2 dropped = q - float2(0.0, (0.07999999821186065673828125 * e) - ((_201.uGravity / 0.60000002384185791015625) * (dt - e)));
            float far = length(dropped);
            if ((far < rMin) || (far > rMax))
            {
                continue;
            }
            float param_11 = sid;
            float a0 = spoke(param_11, _201);
            float param_12 = sid + 1.0;
            float a1 = spoke(param_12, _201);
            float2 d0 = float2(cos(a0), sin(a0));
            float2 d1 = float2(cos(a1), sin(a1));
            float2 dir = fast::normalize(d0 + d1);
            float spread = ((d0.x * d1.y) - (d0.y * d1.x)) / (1.0 + dot(d0, d1));
            float near = length(float2(radial, (1.14999997615814208984375 * span) * spread)) + 0.02999999932944774627685546875;
            bool _1139 = far > near;
            bool _1154;
            if (_1139)
            {
                _1154 = dot(dropped, dir) < sqrt((far * far) - (near * near));
            }
            else
            {
                _1154 = _1139;
            }
            if (_1154)
            {
                continue;
            }
            if (j > 0)
            {
                float2 param_13 = float2(sid, ring + 0.5);
                _1161 = lo * (0.85000002384185791015625 + (0.300000011920928955078125 * hash12(param_13)));
            }
            else
            {
                _1161 = 0.0;
            }
            float inner = _1161;
            if ((j + 1) < 8)
            {
                float2 param_14 = float2(sid, ring + 1.5);
                _1180 = span * (0.85000002384185791015625 + (0.300000011920928955078125 * hash12(param_14)));
            }
            else
            {
                _1180 = inner * _201.uGrowth;
            }
            float outer = _1180;
            if (j > 0)
            {
                _1202 = 0.5 * (inner + outer);
            }
            else
            {
                _1202 = 0.660000026226043701171875 * outer;
            }
            float rc = _1202;
            float reach = length(float2(fast::max(outer - rc, rc - inner), outer * spread)) + 0.00999999977648258209228515625;
            float2 cen = dir * rc;
            float2 param_15 = float2(sid, ring) + float2(17.299999237060546875);
            float2 h = hash22(param_15);
            float2 rel = (dropped - cen) - (((fast::normalize(cen + float2(9.9999997473787516355514526367188e-05)) * (0.0500000007450580596923828125 + (0.1500000059604644775390625 * h.x))) / float2(1.0 + ring)) * e);
            if (dot(rel, rel) > (reach * reach))
            {
                continue;
            }
            float ang = (((h.y - 0.5) * 2.0) * _201.uSpin) * dt;
            float tilt = cos((dt * (0.60000002384185791015625 + (1.2000000476837158203125 * h.x))) * _201.uSpin);
            float param_16 = -ang;
            float2 local = rot(param_16) * rel;
            local.x /= (sign(tilt) * fast::max(abs(tilt), 0.0500000007450580596923828125));
            float2 orig = cen + local;
            float side0 = (d0.x * orig.y) - (d0.y * orig.x);
            float side1 = (d1.x * orig.y) - (d1.y * orig.x);
            float d = dot(orig, dir);
            float rim = ((j + 1) < 8) ? outer : 1000.0;
            if (((side0 < 0.0) || (side1 >= 0.0)) || (d >= rim))
            {
                continue;
            }
            bool past = true;
            for (int i = 1; i < 8; i++)
            {
                if (i > j)
                {
                    break;
                }
                float param_17 = sid;
                float param_18 = float(i);
                if (d < ringAt(param_17, param_18, _201))
                {
                    past = false;
                    break;
                }
            }
            if (!past)
            {
                continue;
            }
            float edge = fast::min(rim - d, fast::min(abs(side0), abs(side1)));
            if (j > 0)
            {
                edge = fast::min(edge, d - inner);
            }
            best = tr;
            hit = float4(orig, tilt, edge);
            hitCentre = cen;
        }
    }
    if (best < 1000.0)
    {
        float2 uv = ((c + hit.xy) * toUv) + float2(0.5);
        float rim_1 = smoothstep(0.01400000043213367462158203125, 0.0, hit.w);
        float2 o = (fast::normalize((hit.xy - hitCentre) + float2(9.9999997473787516355514526367188e-05)) * rim_1) * 0.008000000379979610443115234375;
        float2 param_19 = uv;
        float4 g = pictureRGBA(uImage, uImageSmplr, param_19, _201);
        float2 param_20 = uv + o;
        float2 param_21 = uv - o;
        float3 pic = float3(pictureRGBA(uImage, uImageSmplr, param_20, _201).x, g.y, pictureRGBA(uImage, uImageSmplr, param_21, _201).z);
        float facing = abs(hit.z);
        pic = mix(pic, float3(0.699999988079071044921875, 0.819999992847442626953125, 0.87999999523162841796875), float3(0.20000000298023223876953125 * (1.0 - facing))) * (0.550000011920928955078125 + (0.449999988079071044921875 * facing));
        pic += (float3(0.89999997615814208984375, 0.9700000286102294921875, 1.0) * (rim_1 * (0.300000011920928955078125 + (0.699999988079071044921875 * powr(1.0 - facing, 2.0)))));
        pic += ((float3(0.800000011920928955078125, 0.89999997615814208984375, 1.0) * powr(fast::max(1.0 - abs(hit.z - 0.300000011920928955078125), 0.0), 24.0)) * 0.5);
        col = float4(pic, g.w);
    }
    else
    {
        float2 param_22 = q;
        float3 own = shardOf(param_22, _201);
        float param_23 = own.x;
        float param_24 = own.y;
        if (age < release(param_23, param_24))
        {
            float r = length(q);
            float reach_1 = smoothstep(age * 5.0, (age * 5.0) - 0.0500000007450580596923828125, r);
            float crack = smoothstep(px * 1.60000002384185791015625, 0.0, own.z) * reach_1;
            float near_1 = smoothstep(px * 6.0, px * 1.5, own.z) * reach_1;
            float2 param_25 = ((p + (float2(0.0030000000260770320892333984375, -0.00200000009499490261077880859375) * near_1)) * toUv) + float2(0.5);
            float4 pic_1 = pictureRGBA(uImage, uImageSmplr, param_25, _201);
            float2 param_26 = own.xy;
            float3 rgb = ((pic_1.xyz * (1.0 - (0.180000007152557373046875 * near_1))) * (1.0 + ((reach_1 * 0.07999999821186065673828125) * (hash12(param_26) - 0.5)))) + float3(0.85000002384185791015625 * crack);
            float2 param_27 = floor(fragCoord / float2(2.0));
            float crush = smoothstep(0.02999999932944774627685546875, 0.004999999888241291046142578125, r) * (0.4000000059604644775390625 + (0.60000002384185791015625 * hash12(param_27)));
            col = float4(mix(rgb, float3(0.930000007152557373046875, 0.959999978542327880859375, 1.0), float3(0.800000011920928955078125 * crush)), pic_1.w);
        }
    }
    fragColor = mix(col, intact, float4(smoothstep(_201.uRestore, _201.uRestore + 1.0, age)));
}

static inline __attribute__((always_inline))
float4 flair_backgroundOpacity(thread const float4& c, thread const float3& bg, thread const float& opacity)
{
    if (opacity >= 1.0)
    {
        return c;
    }
    float3 d = fast::clamp(c.xyz, float3(0.0), float3(1.0)) - bg;
    float3 room = mix(bg, float3(1.0) - bg, step(float3(0.0), d));
    float3 k = abs(d) / fast::max(room, float3(9.9999997473787516355514526367188e-05));
    float a = fast::clamp(fast::max(k.x, fast::max(k.y, k.z)), 0.0, 1.0);
    float3 _1695;
    if (a > 0.0)
    {
        _1695 = bg + (d / float3(a));
    }
    else
    {
        _1695 = bg;
    }
    float3 fg = _1695;
    float alpha = a + (opacity * (1.0 - a));
    float3 _1717;
    if (alpha > 0.0)
    {
        _1717 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _1717 = bg;
    }
    float3 col = _1717;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _201, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _201, uImage, uImageSmplr);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = float3(_201.uBackground);
    float param_4 = _201.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_glass_shatter_frag_out flair_glass_shatter_frag(constant FlairUniforms& _201 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_glass_shatter_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _1774;
    if (_201.flair_flipY > 0.5)
    {
        _1774 = _201.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1774 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1774);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _201, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

